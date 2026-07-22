// Mevcut haber havuzunu (newsFetcher.ts'in taradığı NewsItem) alaka/özgünlük/eyleme-
// geçirilebilirlik boyutlarında AI ile skorlar, önceliklendirir ("Fit Matrix" kavramından
// ilhamla, kendi eşik/skorumuz) ve kısa founder briefing'leri üretir.
import { prisma } from '../lib/prisma';
import { chatJson } from './ai';
import { createDraftPost } from './publisher';

const SCAN_CANDIDATE_POOL = 20;
const SCAN_BATCH_SIZE = 5;

type Verdict = 'ACT_NOW' | 'PLAN' | 'WATCH' | 'PASS';

function computeVerdict(total: number): Verdict {
  if (total >= 24) return 'ACT_NOW';
  if (total >= 18) return 'PLAN';
  if (total >= 12) return 'WATCH';
  return 'PASS';
}

// v1: gerçek zamanlı algılama yok — sayaç sinyal oluşturulduğu anda başlar.
function computeRespondByAt(verdict: Verdict): Date | null {
  if (verdict === 'ACT_NOW') return new Date(Date.now() + 60 * 60 * 1000);
  if (verdict === 'PLAN') return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return null;
}

interface ScoreResult {
  relevance: number;
  authenticity: number;
  actionability: number;
}

function clampScore(n: any): number {
  return Math.max(1, Math.min(10, Math.round(Number(n)) || 5));
}

async function scoreSignal(title: string, description: string): Promise<ScoreResult> {
  const prompt = `Sen bir trend analistisin. Aşağıdaki haberi/sinyali üç boyutta 1-10 arası puanla:
- relevance (alaka): markanın nişiyle ne kadar ilgili
- authenticity (özgünlük): ne kadar orijinal/dikkat çekici bir açı sunuyor
- actionability (eyleme geçirilebilirlik): bundan ne kadar kolay içerik üretilebilir

Sadece şu şemada JSON döndür: {"relevance": N, "authenticity": N, "actionability": N}

Başlık: ${title}
Açıklama: ${description.slice(0, 500)}`;

  const parsed = await chatJson(prompt, 0.4);
  if (
    typeof parsed?.relevance === 'number' &&
    typeof parsed?.authenticity === 'number' &&
    typeof parsed?.actionability === 'number'
  ) {
    return {
      relevance: clampScore(parsed.relevance),
      authenticity: clampScore(parsed.authenticity),
      actionability: clampScore(parsed.actionability),
    };
  }
  // AI kapalı/başarısız — sabit orta-skor (WATCH bandına düşer), çökme yerine gerçekçi fallback.
  return { relevance: 6, authenticity: 5, actionability: 6 };
}

async function persistSignal(
  userId: string,
  input: { title: string; description?: string; sourceUrl?: string; sourceNewsItemId?: string }
) {
  const score = await scoreSignal(input.title, input.description || '');
  const totalScore = score.relevance + score.authenticity + score.actionability;
  const verdict = computeVerdict(totalScore);
  return prisma.trendSignal.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      sourceUrl: input.sourceUrl,
      sourceNewsItemId: input.sourceNewsItemId,
      relevanceScore: score.relevance,
      authenticityScore: score.authenticity,
      actionabilityScore: score.actionability,
      totalScore,
      verdict,
      respondByAt: computeRespondByAt(verdict),
    },
  });
}

export async function scanTrends(userId: string) {
  const niche = await prisma.niche.findFirst({ where: { userId, active: true } });
  if (!niche) return { created: 0 };

  const sources = await prisma.newsSource.findMany({ where: { userId, active: true, nicheId: niche.id } });
  const sourceIds = sources.map((s: any) => s.id);
  if (!sourceIds.length) return { created: 0 };

  // "notIn" mock store'da desteklenmiyor — zaten skorlanmışları JS tarafında ele.
  const alreadyScored = await prisma.trendSignal.findMany({ where: { userId }, select: { sourceNewsItemId: true } });
  const scoredIds = new Set(alreadyScored.map((s: any) => s.sourceNewsItemId).filter(Boolean));

  const recentItems = await prisma.newsItem.findMany({
    where: { sourceId: { in: sourceIds } },
    orderBy: { publishedAt: 'desc' },
    take: SCAN_CANDIDATE_POOL,
  });
  const candidates = recentItems.filter((i: any) => !scoredIds.has(i.id)).slice(0, SCAN_BATCH_SIZE);

  for (const item of candidates) {
    await persistSignal(userId, {
      title: item.title,
      description: item.summary || item.content || '',
      sourceUrl: item.url,
      sourceNewsItemId: item.id,
    });
  }
  return { created: candidates.length };
}

export interface ManualTrendInput {
  title: string;
  description?: string;
  sourceUrl?: string;
}

export async function createManualTrend(userId: string, input: ManualTrendInput) {
  return persistSignal(userId, input);
}

export async function listTrends(userId: string) {
  return prisma.trendSignal.findMany({
    where: { userId },
    orderBy: [{ totalScore: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  });
}

export async function draftFromTrend(userId: string, trendId: string) {
  const trend = await prisma.trendSignal.findFirst({ where: { id: trendId, userId } });
  if (!trend) throw new Error('Sinyal bulunamadı');
  const persona = await prisma.persona.findFirst({ where: { userId, isDefault: true } });
  if (!persona) throw new Error('Aktif persona bulunamadı');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Kullanıcı bulunamadı');

  const prompt = `Sen bir sosyal medya içerik editörüsün. Aşağıdaki trend sinyalini, belirtilen "persona" tonuyla kısa ve öz bir sosyal medya gönderisine dönüştür.

Ton: ${persona.tone}
Dil: ${user.publishLanguage}
${persona.voiceRules ? `Ek kurallar: ${persona.voiceRules}` : ''}

Kurallar:
- Başlık: maksimum 90 karakter.
- Metin: 400-900 karakter.
- Sonunda 3-5 ilgili hashtag ekle.

Sadece şu şemada JSON döndür: {"title": "...", "body": "...", "hashtags": ["#..."]}

Trend başlığı: ${trend.title}
${trend.description ? `Açıklama: ${trend.description}` : ''}`;

  const parsed = await chatJson(prompt, 0.7);
  const draft =
    parsed?.title && parsed?.body
      ? { title: parsed.title, body: parsed.body, hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [] }
      : { title: trend.title, body: trend.description || trend.title, hashtags: [] as string[] };

  const post = await createDraftPost(userId, {
    origin: 'TREND',
    title: draft.title,
    body: draft.body,
    hashtags: draft.hashtags,
    personaId: persona.id,
  });

  await prisma.trendSignal.update({ where: { id: trendId }, data: { generatedPostId: post.id } });
  return post;
}

function mockBriefing(trends: any[], pendingCount: number): string {
  if (!trends.length) return `Bu dönemde yeni trend sinyali yok. Onay bekleyen ${pendingCount} taslak var.`;
  const lines = trends.map((t: any) => `- [${t.verdict}] ${t.title} (skor ${t.totalScore}/30)`);
  return `Bu dönemin öne çıkan sinyalleri:\n${lines.join('\n')}\n\nOnay bekleyen ${pendingCount} taslak var.`;
}

export async function generateBriefing(userId: string, type: 'FOUNDER_BRIEFING_DAILY' | 'FOUNDER_BRIEFING_WEEKLY') {
  const periodStart = new Date(Date.now() - (type === 'FOUNDER_BRIEFING_DAILY' ? 1 : 7) * 24 * 60 * 60 * 1000);
  const periodEnd = new Date();

  const trends = await prisma.trendSignal.findMany({
    where: { userId, createdAt: { gte: periodStart } },
    orderBy: { totalScore: 'desc' },
    take: 10,
  });
  const pendingCount = await prisma.post.count({ where: { userId, status: 'PENDING_APPROVAL' } });

  let content: string;
  if (trends.length) {
    const prompt = `Sen bir kurucu (founder) için ${
      type === 'FOUNDER_BRIEFING_DAILY' ? 'günlük' : 'haftalık'
    } özet hazırlıyorsun. Aşağıdaki trend sinyallerinin her biri için "neden önemli + ne yapmalı" formatında, toplamda 2 dakikada okunabilir kısa bir brief yaz. Ayrıca onay bekleyen ${pendingCount} taslak olduğunu belirt.

Sadece şu şemada JSON döndür: {"briefing": "..."}

Sinyaller:
${trends.map((t: any) => `- [${t.verdict}, skor ${t.totalScore}/30] ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n')}`;

    const parsed = await chatJson(prompt, 0.6);
    content =
      typeof parsed?.briefing === 'string' && parsed.briefing.trim()
        ? parsed.briefing.trim()
        : mockBriefing(trends, pendingCount);
  } else {
    content = mockBriefing(trends, pendingCount);
  }

  return prisma.report.create({ data: { userId, type, periodStart, periodEnd, content } });
}

// scheduler.ts'in günlük cron'u tarafından çağrılır (planner.ts'teki
// generateSlotsForAllUsers ile aynı tek-kiracılı-bugün / çoklu-kiracıya-hazır desen).
export async function scanTrendsForAllUsers() {
  const users = await prisma.user.findMany({ select: { id: true } });
  let total = 0;
  for (const u of users) {
    const { created } = await scanTrends(u.id);
    total += created;
  }
  return total;
}

export async function listReports(userId: string) {
  return prisma.report.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
}
