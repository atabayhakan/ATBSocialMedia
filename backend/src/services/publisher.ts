import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { env, mediaBaseUrl } from '../lib/env';
import { decryptSecret } from '../lib/crypto';
import { generatePostFromNews } from './ai';
import { pickNextNewsItemForUser } from './newsFetcher';
import { fillCanvaTemplate } from './canva';
import { renderPostImage, type PanelPosition, type TextColor } from './imageRenderer';

export interface CreateDraftPostInput {
  origin: 'NEWS' | 'CALENDAR' | 'REPURPOSE' | 'TREND' | 'MANUAL';
  title: string;
  body: string;
  hashtags: string[];
  personaId?: string;
  nicheId?: string;
  sourceItemId?: string;
  // Şablon/Canva görselinden SONRA eklenir (örn. haber görseli) — birden fazla
  // görsel aynı anda mediaUrls'te durabilir, mevcut davranışla birebir aynı.
  extraMediaUrls?: string[];
  meta?: any;
}

// Gönderi-oluşturma çekirdeği: görsel üretimi (kendi şablon → Canva fallback) +
// Post satırı + FULLY_AUTONOMOUS'ta otomatik onay. Kaynağı ne olursa olsun (haber,
// takvim, yeniden-kullanım, trend, manuel) tüm üretim yolları bunu çağırır.
export async function createDraftPost(userId: string, input: CreateDraftPostInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Kullanıcı bulunamadı');

  const mediaUrls: string[] = [];
  let canvaDesignId: string | undefined;

  // Öncelik: kendi (ücretsiz, self-hosted) görsel şablonumuz — Canva Autofill
  // Enterprise plana kilitli olduğu için varsayılan yol burası.
  const imageTemplate = await prisma.imageTemplate.findFirst({ where: { userId, isDefault: true } });
  if (imageTemplate) {
    try {
      const buf = await renderPostImage(
        {
          backgroundPath: imageTemplate.backgroundPath,
          width: imageTemplate.width,
          height: imageTemplate.height,
          panelPosition: imageTemplate.panelPosition as PanelPosition,
          textColor: imageTemplate.textColor as TextColor,
        },
        { title: input.title, body: input.body, hashtags: input.hashtags }
      );
      const generatedDir = path.join(__dirname, '../../uploads/generated');
      fs.mkdirSync(generatedDir, { recursive: true });
      const fileName = `${randomUUID()}.png`;
      fs.writeFileSync(path.join(generatedDir, fileName), buf);
      mediaUrls.push(`${mediaBaseUrl}/media/generated/${fileName}`);
    } catch (e: any) {
      logger.warn({ e }, 'Görsel şablonundan render başarısız, Canva/haber görseline düşülecek');
    }
  } else {
    const canvaCfg = await prisma.canvaConfig.findUnique({ where: { userId } });
    if (canvaCfg) {
      try {
        const design = await fillCanvaTemplate(
          userId,
          { title: input.title, body: input.body, hashtags: input.hashtags },
          canvaCfg.defaultTemplateId || undefined
        );
        canvaDesignId = design.id;
        if (design.exportUrl) mediaUrls.push(design.exportUrl);
      } catch (e: any) {
        logger.warn({ e }, 'Canva tasarımı oluşturulamadı, görselsiz devam edilecek');
      }
    }
  }

  if (input.extraMediaUrls?.length) mediaUrls.push(...input.extraMediaUrls);

  const post = await prisma.post.create({
    data: {
      userId,
      personaId: input.personaId,
      nicheId: input.nicheId,
      sourceItemId: input.sourceItemId,
      origin: input.origin as any,
      status: 'PENDING_APPROVAL',
      mode: user.defaultMode,
      title: input.title,
      body: input.body,
      hashtags: input.hashtags,
      mediaUrls,
      canvaDesignId,
      meta: input.meta,
    },
  });

  if (user.defaultMode === 'FULLY_AUTONOMOUS') {
    return approvePost(post.id);
  }

  return post;
}

export async function generatePostForUser(userId: string, opts?: { nicheId?: string }) {
  const persona = await prisma.persona.findFirst({
    where: { userId, isDefault: true },
  });
  if (!persona) throw new Error('Aktif persona bulunamadı');

  // pickNextNewsItemForUser haberi ATOMİK olarak sahiplenir (used=true) — böylece
  // eşzamanlı iki üretim aynı haberden mükerrer gönderi üretemez (race koruması).
  const newsItem = await pickNextNewsItemForUser(userId);
  if (!newsItem) throw new Error('Yayınlanacak uygun haber bulunamadı');

  // Gönderi oluşturulana kadar herhangi bir adım başarısız olursa (özellikle AI
  // üretimi) haberi tekrar seçilebilir yap — transient hata haberi boşa harcamasın.
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Kullanıcı bulunamadı');

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

    return await createDraftPost(userId, {
      origin: 'NEWS',
      title: generated.title,
      body: generated.body,
      hashtags: generated.hashtags,
      personaId: persona.id,
      nicheId: opts?.nicheId,
      sourceItemId: newsItem.id,
      extraMediaUrls: newsItem.imageUrl ? [newsItem.imageUrl] : [],
    });
  } catch (e) {
    await prisma.newsItem.update({ where: { id: newsItem.id }, data: { used: false } }).catch(() => {});
    throw e;
  }
}

export async function approvePost(postId: string, scheduledAt?: Date) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Gönderi bulunamadı');

  const targets = await prisma.postTarget.findMany({ where: { postId } });

  // Hedef yoksa aktif hesaplardan üret. Hiç aktif hesap yoksa "target'sız APPROVED"
  // çıkmazına düşmek yerine açık hata ver — post PENDING_APPROVAL'da kalır, sessizce
  // yayınlanamaz durumda takılmaz.
  if (targets.length === 0) {
    const accounts = await prisma.socialAccount.findMany({ where: { userId: post.userId, active: true } });
    if (accounts.length === 0) {
      throw new Error('Aktif sosyal hesap yok — önce Sosyal Hesaplar sayfasından bir hesap bağla');
    }
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

// Yeniden başlatma bir yayını yarıda kesmişse hedef PUBLISHING'de askıda kalır.
// 10 dakikadan eski PUBLISHING hedeflerini FAILED'a çevirir (açılışta + periyodik çağrılır).
export async function sweepStuckTargets() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const { count } = await prisma.postTarget.updateMany({
    where: { status: 'PUBLISHING', updatedAt: { lt: cutoff } },
    data: { status: 'FAILED', error: 'Yayın yarıda kesildi (askıda kaldı) — tekrar deneyebilirsin' },
  });
  if (count > 0) logger.warn({ count }, 'Askıda kalan yayın hedefleri FAILED olarak işaretlendi');
  return count;
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
    // Zamanı gelmemiş gönderiyi atla (hedef durumu ne olursa olsun post seviyesinde kontrol)
    if (target.post.scheduledAt && new Date(target.post.scheduledAt) > now) {
      continue;
    }
    try {
      await publishToPlatform(target.postId, target.id);
    } catch (e: any) {
      logger.error({ e, targetId: target.id }, 'Yayınlama hatası');
    }
  }
}

// Post'un tüm hedefleri terminal (PUBLISHED/FAILED/REJECTED) olduğunda post'u nihai
// duruma taşır. Kısmi başarıda bile post APPROVED/SCHEDULED'da sonsuza dek takılmaz.
// REJECTED/PUBLISHED/FAILED post'a dokunmaz — in-flight yayın bitse bile reddedilmiş
// post "diriltilmez".
async function finalizePostStatus(postId: string) {
  const targets = await prisma.postTarget.findMany({ where: { postId } });
  if (targets.length === 0) return;
  const stillWorking = targets.some(
    (t: any) => t.status === 'APPROVED' || t.status === 'SCHEDULED' || t.status === 'PUBLISHING'
  );
  if (stillWorking) return;

  const anyPublished = targets.some((t: any) => t.status === 'PUBLISHED');
  const anyFailed = targets.some((t: any) => t.status === 'FAILED');

  await prisma.post.updateMany({
    where: { id: postId, status: { in: ['APPROVED', 'SCHEDULED', 'PUBLISHING'] } },
    data: {
      status: anyPublished ? 'PUBLISHED' : 'FAILED',
      publishedAt: anyPublished ? new Date() : null,
      error: anyFailed ? (anyPublished ? 'Bazı kanallara yayınlanamadı' : 'Hiçbir kanala yayınlanamadı') : null,
    },
  });
}

export async function publishToPlatform(postId: string, targetId: string) {
  // ATOMİK sahiplenme: yalnız işlenebilir (APPROVED/SCHEDULED veya FAILED-retry) bir
  // hedefi PUBLISHING'e al. Eşzamanlı başka bir tick/manuel çağrı hedefi çoktan
  // sahiplendiyse (PUBLISHING/PUBLISHED/REJECTED) count 0 döner ve sessizce atlanır —
  // bu, çift yayını (aynı gönderinin iki kez paylaşılması) engelleyen kilittir.
  const claim = await prisma.postTarget.updateMany({
    where: { id: targetId, status: { in: ['APPROVED', 'SCHEDULED', 'FAILED'] } },
    data: { status: 'PUBLISHING', error: null },
  });
  if (claim.count === 0) return;

  const target = await prisma.postTarget.findUnique({
    where: { id: targetId },
    include: { post: true, account: true },
  });
  if (!target) return;

  let externalId = '';
  try {
    // Token'lar DB'de şifreli durur; sadece kullanım anında bellekte çözülür. Decrypt
    // PUBLISHING geçişinden SONRA ve try içinde — bozuk token/eksik anahtarda hedef
    // FAILED olur (aksi halde her 2 dk'da sessizce sonsuz retry ederdi).
    target.account.accessToken = decryptSecret(target.account.accessToken)!;
    target.account.refreshToken = decryptSecret(target.account.refreshToken);

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
      case 'TELEGRAM':
        externalId = await publishTelegram(target);
        break;
      case 'BLUESKY':
        externalId = await publishBluesky(target);
        break;
    }
  } catch (e: any) {
    const message = e?.response?.data?.error?.message || e.message || 'Bilinmeyen hata';
    await prisma.postTarget.update({
      where: { id: targetId },
      data: { status: 'FAILED', error: message },
    });
    await finalizePostStatus(postId);
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

  await finalizePostStatus(postId);
}

// Platform HTTP çağrıları için üst sınır — timeout'suz axios çağrısı TCP seviyesinde
// süresiz asılabilir, bu da sweepStuckTargets ile yarışıp yanlış FAILED/çift yayına yol açar.
const PUBLISH_TIMEOUT = 30_000;

const TWEET_LIMIT = 280;
const TWEET_URL_WEIGHT = 23; // Twitter her linki uzunluğundan bağımsız 23 karakter sayar
const URL_REGEX = /https?:\/\/\S+/g;

export function tweetWeightedLength(s: string): number {
  const urls = s.match(URL_REGEX) || [];
  return urls.reduce((len, u) => len + TWEET_URL_WEIGHT - u.length, s.length);
}

export function trimForTwitter(title: string, body: string, hashtags: string[]): string {
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
    { headers: { Authorization: `Bearer ${target.account.accessToken}` }, timeout: PUBLISH_TIMEOUT }
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
    { headers: { Authorization: `Bearer ${target.account.accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' }, timeout: PUBLISH_TIMEOUT }
  );
  return data?.id;
}

async function publishInstagram(target: any): Promise<string> {
  if (!target.post.mediaUrls[0]) throw new Error('Instagram için görsel zorunlu');
  const igUserId = target.account.externalId;
  const caption = `${target.post.title}\n\n${target.post.body}\n\n${target.post.hashtags.join(' ')}`;
  
  // Localhost/göreli URL'leri genel erişimli domain'e (https://www.sponsorify.tech) dönüştür
  let imageUrl = target.post.mediaUrls[0];
  if (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.0.0.1') || imageUrl.startsWith('/')) {
    const cleanPath = imageUrl.replace(/^https?:\/\/[^\/]+/, '');
    const baseUrl = env.MEDIA_BASE_URL || env.APP_URL || 'https://www.sponsorify.tech';
    imageUrl = `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
  }

  // 1. Instagram Medya Kapsayıcısı (Container) Oluştur
  const creation = await axios.post(
    `https://graph.facebook.com/v20.0/${igUserId}/media`,
    { image_url: imageUrl, caption, access_token: target.account.accessToken },
    { timeout: PUBLISH_TIMEOUT }
  );
  const containerId = creation.data.id;

  // 2. Instagram Görseli İşleyip Hazır Edene Kadar Bekle (Status Polling)
  let status = 'IN_PROGRESS';
  let retries = 0;
  while (status !== 'FINISHED' && retries < 10) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const statusRes = await axios.get(
        `https://graph.facebook.com/v20.0/${containerId}`,
        { params: { fields: 'status_code,status', access_token: target.account.accessToken }, timeout: PUBLISH_TIMEOUT }
      );
      status = statusRes.data.status_code;
      if (status === 'ERROR') {
        throw new Error(`Instagram görsel işleme hatası: ${statusRes.data.status || 'Bilinmeyen Meta hatası'}`);
      }
    } catch (e: any) {
      if (retries >= 3) throw e;
    }
    retries++;
  }

  // 3. Medyayı Yayınla
  const publish = await axios.post(
    `https://graph.facebook.com/v20.0/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: target.account.accessToken },
    { timeout: PUBLISH_TIMEOUT }
  );
  return publish.data.id;
}

async function publishFacebook(target: any): Promise<string> {
  const message = `${target.post.title}\n\n${target.post.body}\n\n${target.post.hashtags.join(' ')}`;
  const body: any = { message, access_token: target.account.accessToken };
  if (target.post.mediaUrls[0]) body.link = target.post.mediaUrls[0];
  const { data } = await axios.post(
    `https://graph.facebook.com/v20.0/${target.account.externalId}/feed`,
    body,
    { timeout: PUBLISH_TIMEOUT }
  );
  return data.id;
}

// Telegram: accessToken = bot token, externalId = kanal chat_id (@kanaladi veya -100...)
// Bot, kanala yönetici olarak eklenmiş olmalı.
async function publishTelegram(target: any): Promise<string> {
  const botToken = target.account.accessToken;
  const chatId = target.account.externalId;
  const text = `${target.post.title}\n\n${target.post.body}\n\n${target.post.hashtags.join(' ')}`;
  const imageUrl = target.post.mediaUrls[0];

  if (imageUrl) {
    // sendPhoto caption sınırı 1024 karakter
    const { data } = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      { chat_id: chatId, photo: imageUrl, caption: text.slice(0, 1024) },
      { timeout: PUBLISH_TIMEOUT }
    );
    return String(data?.result?.message_id ?? '');
  }

  const { data } = await axios.post(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    { chat_id: chatId, text: text.slice(0, 4096) },
    { timeout: PUBLISH_TIMEOUT }
  );
  return String(data?.result?.message_id ?? '');
}

// Bluesky: externalId = handle (ornek.bsky.social), accessToken = App Password
// (Bluesky ayarlarından üretilir; normal hesap şifresi DEĞİL).
const BSKY_LIMIT = 300;

async function publishBluesky(target: any): Promise<string> {
  const service = 'https://bsky.social';
  const session = await axios.post(
    `${service}/xrpc/com.atproto.server.createSession`,
    { identifier: target.account.externalId, password: target.account.accessToken },
    { timeout: PUBLISH_TIMEOUT }
  );
  const { accessJwt, did } = session.data;
  const authHeaders = { Authorization: `Bearer ${accessJwt}` };

  const suffix = target.post.hashtags.length ? `\n\n${target.post.hashtags.join(' ')}` : '';
  let main = `${target.post.title}\n\n${target.post.body}`;
  const budget = BSKY_LIMIT - suffix.length;
  if (main.length > budget) main = main.slice(0, Math.max(0, budget - 3)).replace(/\s+\S*$/, '') + '...';
  const text = main + suffix;

  const record: any = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  };

  // Görsel varsa blob olarak yükleyip embed et; başarısız olursa metinle devam
  const imageUrl = target.post.mediaUrls[0];
  if (imageUrl) {
    try {
      const img = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20_000 });
      const contentType = img.headers['content-type'] || 'image/jpeg';
      const upload = await axios.post(`${service}/xrpc/com.atproto.repo.uploadBlob`, img.data, {
        headers: { ...authHeaders, 'Content-Type': contentType },
        maxBodyLength: Infinity,
        timeout: PUBLISH_TIMEOUT,
      });
      record.embed = {
        $type: 'app.bsky.embed.images',
        images: [{ image: upload.data.blob, alt: target.post.title.slice(0, 100) }],
      };
    } catch (e: any) {
      logger.warn({ e: e?.message }, 'Bluesky görsel yüklenemedi, metinle devam ediliyor');
    }
  }

  const { data } = await axios.post(
    `${service}/xrpc/com.atproto.repo.createRecord`,
    { repo: did, collection: 'app.bsky.feed.post', record },
    { headers: authHeaders, timeout: PUBLISH_TIMEOUT }
  );
  return data?.uri || '';
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
    { headers: { Authorization: `Bearer ${target.account.accessToken}` }, timeout: PUBLISH_TIMEOUT }
  );
  return init.data?.data?.publish_id;
}
