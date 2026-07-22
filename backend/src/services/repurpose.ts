// Uzun-form metni (blog/podcast transkripti/newsletter) çoklu taslak gönderiye böler.
// "Insight extraction" — özetleme değil, bağımsız anlaşılır en çarpıcı parçaları seçme —
// sonra her parça createDraftPost(origin:'REPURPOSE') ile normal onay kuyruğuna düşer.
import { prisma } from '../lib/prisma';
import { chatJson } from './ai';
import { createDraftPost } from './publisher';

const TYPE_LABELS: Record<string, string> = {
  BLOG: 'blog yazısı',
  PODCAST_TRANSCRIPT: 'podcast transkripti',
  NEWSLETTER: 'bülten (newsletter)',
  MANUAL_TEXT: 'metin',
};

function mockExtractInsights(rawText: string): string[] {
  const sentences = rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
  return sentences.length ? sentences.slice(0, 3) : [rawText.slice(0, 200)];
}

async function extractInsights(rawText: string, type: string): Promise<string[]> {
  const label = TYPE_LABELS[type] || 'metin';
  const prompt = `Sen bir içerik editörüsün. Aşağıdaki ${label} metninden, her biri TEK BAŞINA anlaşılır ve sosyal medyada paylaşılabilir en çarpıcı 3-5 fikri/anı çıkar. Özetleme yapma — metnin en güçlü, bağımsız duran parçalarını seç.

Sadece şu şemada JSON döndür: {"insights": ["...", "..."]}

Metin:
${rawText.slice(0, 6000)}`;

  const parsed = await chatJson(prompt, 0.6);
  if (Array.isArray(parsed?.insights) && parsed.insights.length) {
    return parsed.insights.filter((i: any) => typeof i === 'string' && i.trim()).slice(0, 5);
  }
  return mockExtractInsights(rawText);
}

async function draftFromInsight(insight: string, persona: any, language: string) {
  const prompt = `Sen bir sosyal medya içerik editörüsün. Aşağıdaki fikri, belirtilen "persona" tonuyla kısa ve öz bir sosyal medya gönderisine dönüştür.

Ton: ${persona.tone}
Dil: ${language}
${persona.voiceRules ? `Ek kurallar: ${persona.voiceRules}` : ''}

Kurallar:
- Başlık: maksimum 90 karakter.
- Metin: 400-900 karakter.
- Sonunda 3-5 ilgili hashtag ekle.

Sadece şu şemada JSON döndür: {"title": "...", "body": "...", "hashtags": ["#..."]}

Fikir:
${insight}`;

  const parsed = await chatJson(prompt, 0.7);
  if (parsed?.title && parsed?.body) {
    return {
      title: parsed.title,
      body: parsed.body,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
  }
  const clean = insight.replace(/\s+/g, ' ').trim();
  return {
    title: clean.length > 90 ? clean.slice(0, 87) + '...' : clean,
    body: clean,
    hashtags: [] as string[],
  };
}

export interface RepurposeInput {
  type: string;
  title: string;
  rawText: string;
  sourceUrl?: string;
}

export async function repurposeText(userId: string, input: RepurposeInput) {
  const persona = await prisma.persona.findFirst({ where: { userId, isDefault: true } });
  if (!persona) throw new Error('Aktif persona bulunamadı');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Kullanıcı bulunamadı');

  const source = await prisma.repurposeSource.create({
    data: { userId, type: input.type, title: input.title, rawText: input.rawText, sourceUrl: input.sourceUrl },
  });

  const insights = await extractInsights(input.rawText, input.type);
  let postCount = 0;
  for (let i = 0; i < insights.length; i++) {
    const draft = await draftFromInsight(insights[i], persona, user.publishLanguage);
    const post = await createDraftPost(userId, {
      origin: 'REPURPOSE',
      title: draft.title,
      body: draft.body,
      hashtags: draft.hashtags,
      personaId: persona.id,
    });
    await prisma.repurposeInsight.create({
      data: { sourceId: source.id, summary: insights[i], order: i, generatedPostId: post.id },
    });
    postCount++;
  }

  return { source, postCount };
}

export async function listRepurposeSources(userId: string) {
  return prisma.repurposeSource.findMany({
    where: { userId },
    include: { insights: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
