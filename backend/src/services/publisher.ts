import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generatePostFromNews } from './ai';
import { pickNextNewsItemForUser } from './newsFetcher';
import { fillCanvaTemplate } from './canva';

export async function generatePostForUser(userId: string, opts?: { nicheId?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Kullanıcı bulunamadı');

  const persona = await prisma.persona.findFirst({
    where: { userId, isDefault: true },
  });
  if (!persona) throw new Error('Aktif persona bulunamadı');

  const newsItem = await pickNextNewsItemForUser(userId);
  if (!newsItem) throw new Error('Yayınlanacak uygun haber bulunamadı');

  // Dil önceliği: kaynağa özel dil > kullanıcının genel yayın dili > persona dili
  const newsSource = await prisma.newsSource.findUnique({ where: { id: newsItem.sourceId } });
  const targetLanguage = newsSource?.targetLanguage || user.publishLanguage || persona.language;

  const generated = await generatePostFromNews(
    {
      title: newsItem.title,
      summary: newsItem.summary,
      content: newsItem.content,
      url: newsItem.url,
      language: newsItem.language,
    },
    {
      name: persona.name,
      tone: persona.tone,
      language: persona.language,
      voiceRules: persona.voiceRules,
      forbiddenTopics: persona.forbiddenTopics,
    },
    targetLanguage
  );

  const canvaCfg = await prisma.canvaConfig.findUnique({ where: { userId } });
  let canvaDesignId: string | undefined;
  const mediaUrls: string[] = [];

  if (canvaCfg) {
    try {
      const design = await fillCanvaTemplate(
        userId,
        {
          title: generated.title,
          body: generated.body,
          hashtags: generated.hashtags,
        },
        canvaCfg.defaultTemplateId || undefined
      );
      canvaDesignId = design.id;
      if (design.exportUrl) mediaUrls.push(design.exportUrl);
    } catch (e: any) {
      logger.warn({ e }, 'Canva tasarımı oluşturulamadı, görselsiz devam edilecek');
    }
  }

  if (newsItem.imageUrl) mediaUrls.push(newsItem.imageUrl);

  const post = await prisma.post.create({
    data: {
      userId,
      personaId: persona.id,
      nicheId: opts?.nicheId,
      sourceItemId: newsItem.id,
      status: 'PENDING_APPROVAL',
      mode: user.defaultMode,
      title: generated.title,
      body: generated.body,
      hashtags: generated.hashtags,
      mediaUrls,
      canvaDesignId,
    },
  });

  await prisma.newsItem.update({
    where: { id: newsItem.id },
    data: { used: true },
  });

  if (user.defaultMode === 'FULLY_AUTONOMOUS') {
    return approvePost(post.id);
  }

  return post;
}

export async function approvePost(postId: string, scheduledAt?: Date) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Gönderi bulunamadı');

  const targets = await prisma.postTarget.findMany({ where: { postId } });
  const accounts = await prisma.socialAccount.findMany({ where: { userId: post.userId, active: true } });

  if (targets.length === 0 && accounts.length > 0) {
    await prisma.postTarget.createMany({
      data: accounts.map((a: any) => ({
        postId: post.id,
        accountId: a.id,
        platform: a.platform,
        status: 'APPROVED' as any,
      })),
    });
  }

  return prisma.post.update({
    where: { id: postId },
    data: {
      status: scheduledAt ? 'SCHEDULED' : 'APPROVED',
      scheduledAt: scheduledAt || null,
    },
  });
}

export async function processPendingPosts() {
  const now = new Date();
  const targets = await prisma.postTarget.findMany({
    where: {
      status: { in: ['APPROVED', 'SCHEDULED'] },
      post: { status: { in: ['APPROVED', 'SCHEDULED'] } },
    },
    include: { post: true, account: true },
  });

  for (const target of targets) {
    if (target.status === 'SCHEDULED' && target.post.scheduledAt && target.post.scheduledAt > now) {
      continue;
    }
    try {
      await publishToPlatform(target.postId, target.id);
    } catch (e: any) {
      logger.error({ e, targetId: target.id }, 'Yayınlama hatası');
    }
  }
}

export async function publishToPlatform(postId: string, targetId: string) {
  const target = await prisma.postTarget.findUnique({
    where: { id: targetId },
    include: { post: true, account: true },
  });
  if (!target) throw new Error('Target bulunamadı');

  await prisma.postTarget.update({
    where: { id: targetId },
    data: { status: 'PUBLISHING', error: null },
  });

  let externalId = '';
  try {
    switch (target.platform) {
      case 'TWITTER':
        externalId = await publishTwitter(target);
        break;
      case 'LINKEDIN':
        externalId = await publishLinkedIn(target);
        break;
      case 'INSTAGRAM':
        externalId = await publishInstagram(target);
        break;
      case 'FACEBOOK':
        externalId = await publishFacebook(target);
        break;
      case 'TIKTOK':
        externalId = await publishTikTok(target);
        break;
    }
  } catch (e: any) {
    const message = e?.response?.data?.error?.message || e.message || 'Bilinmeyen hata';
    await prisma.postTarget.update({
      where: { id: targetId },
      data: { status: 'FAILED', error: message },
    });
    throw e;
  }

  await prisma.postTarget.update({
    where: { id: targetId },
    data: {
      status: 'PUBLISHED',
      externalId,
      publishedAt: new Date(),
    },
  });

  const remaining = await prisma.postTarget.count({
    where: { postId, status: { not: 'PUBLISHED' } },
  });
  if (remaining === 0) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }
}

const TWEET_LIMIT = 280;
const TWEET_URL_WEIGHT = 23; // Twitter her linki uzunluğundan bağımsız 23 karakter sayar
const URL_REGEX = /https?:\/\/\S+/g;

function tweetWeightedLength(s: string): number {
  const urls = s.match(URL_REGEX) || [];
  return urls.reduce((len, u) => len + TWEET_URL_WEIGHT - u.length, s.length);
}

function trimForTwitter(title: string, body: string, hashtags: string[]): string {
  const suffix = hashtags.length ? `\n\n${hashtags.join(' ')}` : '';
  const budget = TWEET_LIMIT - tweetWeightedLength(suffix);

  let main = `${title}\n\n${body}`;
  if (tweetWeightedLength(main) > budget) {
    const ellipsis = '...';
    while (main.length > 0 && tweetWeightedLength(main) + ellipsis.length > budget) {
      main = main.slice(0, -1);
    }
    main = main.replace(/\s+$/, '') + ellipsis;
  }
  return main + suffix;
}

async function publishTwitter(target: any): Promise<string> {
  const text = trimForTwitter(target.post.title, target.post.body, target.post.hashtags);
  const { data } = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text },
    { headers: { Authorization: `Bearer ${target.account.accessToken}` } }
  );
  return data?.data?.id;
}

async function publishLinkedIn(target: any): Promise<string> {
  const text = `${target.post.title}\n\n${target.post.body}\n\n${target.post.hashtags.join(' ')}`;
  const authorUrn = `urn:li:person:${target.account.externalId}`;
  const { data } = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: target.post.mediaUrls.length ? 'IMAGE' : 'NONE',
          media: target.post.mediaUrls.map((url: string) => ({
            status: 'READY',
            description: { text: target.post.title },
            originalUrl: url,
            title: { text: target.post.title },
          })),
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers: { Authorization: `Bearer ${target.account.accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' } }
  );
  return data?.id;
}

async function publishInstagram(target: any): Promise<string> {
  if (!target.post.mediaUrls[0]) throw new Error('Instagram için görsel zorunlu');
  const igUserId = target.account.externalId;
  const caption = `${target.post.title}\n\n${target.post.body}\n\n${target.post.hashtags.join(' ')}`;
  const creation = await axios.post(
    `https://graph.facebook.com/v20.0/${igUserId}/media`,
    { image_url: target.post.mediaUrls[0], caption, access_token: target.account.accessToken }
  );
  const containerId = creation.data.id;
  const publish = await axios.post(
    `https://graph.facebook.com/v20.0/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: target.account.accessToken }
  );
  return publish.data.id;
}

async function publishFacebook(target: any): Promise<string> {
  const message = `${target.post.title}\n\n${target.post.body}\n\n${target.post.hashtags.join(' ')}`;
  const body: any = { message, access_token: target.account.accessToken };
  if (target.post.mediaUrls[0]) body.link = target.post.mediaUrls[0];
  const { data } = await axios.post(
    `https://graph.facebook.com/v20.0/${target.account.externalId}/feed`,
    body
  );
  return data.id;
}

async function publishTikTok(target: any): Promise<string> {
  if (!target.post.mediaUrls[0]) throw new Error('TikTok için video zorunlu');
  const caption = `${target.post.title} ${target.post.hashtags.join(' ')}`.slice(0, 2200);
  const init = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: { title: caption, privacy_level: 'PUBLIC' },
      source_info: { source: 'PULL_FROM_URL', video_url: target.post.mediaUrls[0] },
    },
    { headers: { Authorization: `Bearer ${target.account.accessToken}` } }
  );
  return init.data?.data?.publish_id;
}
