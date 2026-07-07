import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AiProvider, chatWithProvider, systemProvider, ChatMessage } from './ai';
import { ASSISTANT_KNOWLEDGE } from './assistantKnowledge';
import { isWhatsAppConnected } from './whatsapp';

const HISTORY_LIMIT = 12;

async function resolveProvider(userId: string): Promise<AiProvider> {
  const cfg = await prisma.assistantConfig.findUnique({ where: { userId } });
  if (cfg?.enabled && cfg.apiKey) {
    return { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model };
  }
  return systemProvider();
}

export async function buildLiveContext(userId: string): Promise<string> {
  const [statusGroups, failedTargets, sources, canvaCfg, waCfg, user] = await Promise.all([
    prisma.post.groupBy({ by: ['status'], _count: true, where: { userId } }),
    prisma.postTarget.findMany({
      where: { status: 'FAILED', post: { userId } },
      include: { post: true },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    }),
    prisma.newsSource.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.canvaConfig.findUnique({ where: { userId } }),
    prisma.whatsAppConfig.findFirst({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const statusLine = statusGroups.length
    ? statusGroups.map((g: any) => `${g.status}: ${g._count}`).join(', ')
    : 'hiç gönderi yok';

  const failedLines = failedTargets.length
    ? failedTargets
        .map((t: any) => `- [${t.platform}] "${(t.post?.title || '').slice(0, 60)}" → ${t.error || 'hata mesajı yok'}`)
        .join('\n')
    : 'yok';

  const sourceLines = sources.length
    ? sources
        .map(
          (s: any) =>
            `- ${s.name} (${s.type}, ${s.active ? 'aktif' : 'pasif'}${s.targetLanguage ? `, yayın dili: ${s.targetLanguage}` : ''}) son tarama: ${
              s.lastFetchedAt ? new Date(s.lastFetchedAt).toISOString() : 'henüz taranmadı'
            }`
        )
        .join('\n')
    : 'hiç kaynak yok';

  return `# CANLI SİSTEM DURUMU (şu an: ${new Date().toISOString()})
Gönderi durumları: ${statusLine}
Otonom mod: ${user?.defaultMode || 'bilinmiyor'} | Yayın dili: ${user?.publishLanguage || 'tr'}
WhatsApp: ${isWhatsAppConnected() ? 'bağlı' : 'bağlı değil'}${waCfg ? ` (mod: ${waCfg.mode})` : ' (yapılandırılmamış)'}
Canva: ${canvaCfg ? `bağlı${canvaCfg.defaultTemplateId ? `, varsayılan şablon: ${canvaCfg.defaultTemplateId}` : ', varsayılan şablon seçilmemiş'}` : 'bağlı değil'}

Başarısız yayın hedefleri (son 10):
${failedLines}

Haber kaynakları:
${sourceLines}`;
}

export async function chat(userId: string, message: string): Promise<string> {
  const history = await prisma.assistantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  });
  history.reverse();

  const liveContext = await buildLiveContext(userId);

  const messages: ChatMessage[] = [
    { role: 'system', content: ASSISTANT_KNOWLEDGE + '\n\n' + liveContext },
    ...history.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ];

  const provider = await resolveProvider(userId);
  const reply = await chatWithProvider(provider, messages, { temperature: 0.4 });

  const finalReply =
    reply ||
    'Şu anda AI sağlayıcısına ulaşamıyorum (yoğunluk veya yapılandırma sorunu olabilir). ' +
      'Birkaç dakika sonra tekrar dene; sorun sürerse "Tanı Raporu" oluşturup Cowork üzerinden Claude\'a ilet.';

  await prisma.assistantMessage.create({ data: { userId, role: 'user', content: message } });
  await prisma.assistantMessage.create({ data: { userId, role: 'assistant', content: finalReply } });

  return finalReply;
}

// Env özetinde anahtar/şifre içerebilecek değişkenler asla değer olarak yazılmaz.
function redactedEnvSummary(): string {
  const interesting = [
    'NODE_ENV', 'PORT', 'AI_BASE_URL', 'AI_MODEL', 'AI_FALLBACK_MODELS', 'AI_API_KEY',
    'CORS_ORIGIN', 'WA_QR_ENABLED', 'WA_BUSINESS_ENABLED',
    'CANVA_CLIENT_ID', 'TELEGRAM_BOT_TOKEN', 'SMTP_HOST',
  ];
  const secretPattern = /KEY|TOKEN|SECRET|PASS/i;
  return interesting
    .map((k) => {
      const v = process.env[k];
      if (v === undefined || v === '') return `${k}=(boş)`;
      return secretPattern.test(k) ? `${k}=***AYARLI***` : `${k}=${v}`;
    })
    .join('\n');
}

export async function buildDiagnosticReport(userId: string): Promise<string> {
  const liveContext = await buildLiveContext(userId);

  const [recentPosts, recentErrors] = await Promise.all([
    prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.post.findMany({
      where: { userId, error: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  const postLines = recentPosts.length
    ? recentPosts
        .map((p: any) => `- [${p.status}] "${p.title.slice(0, 70)}" (${new Date(p.createdAt).toISOString()})`)
        .join('\n')
    : 'yok';

  const errorLines = recentErrors.length
    ? recentErrors.map((p: any) => `- "${p.title.slice(0, 50)}": ${p.error}`).join('\n')
    : 'yok';

  return `# ATBSocialMedia Tanı Raporu
> Bu raporu Cowork'te Claude'a yapıştırın. Claude sunucuya bağlanıp sorunu inceleyebilir.
> Sunucu: /opt/atbsocialmedia — detaylar Claude'un hafızasında kayıtlı.

Oluşturulma: ${new Date().toISOString()}
Node: ${process.version} | Uptime: ${Math.round(process.uptime() / 60)} dk

${liveContext}

## Son 5 gönderi
${postLines}

## Hata kaydı olan gönderiler
${errorLines}

## Ortam değişkenleri (anahtarlar redakte)
\`\`\`
${redactedEnvSummary()}
\`\`\`
`;
}

export async function getConfig(userId: string) {
  const cfg = await prisma.assistantConfig.findUnique({ where: { userId } });
  return {
    enabled: cfg?.enabled ?? false,
    baseUrl: cfg?.baseUrl ?? 'https://openrouter.ai/api/v1',
    model: cfg?.model ?? 'qwen/qwen3-next-80b-a3b-instruct:free',
    hasKey: !!cfg?.apiKey,
  };
}

export async function updateConfig(
  userId: string,
  data: { enabled?: boolean; apiKey?: string; baseUrl?: string; model?: string }
) {
  // Boş string gönderilen apiKey "anahtarı sil" anlamına gelir; undefined ise dokunulmaz
  const patch: any = {};
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  if (data.baseUrl !== undefined) patch.baseUrl = data.baseUrl;
  if (data.model !== undefined) patch.model = data.model;
  if (data.apiKey !== undefined) patch.apiKey = data.apiKey === '' ? null : data.apiKey;

  await prisma.assistantConfig.upsert({
    where: { userId },
    create: {
      userId,
      enabled: patch.enabled ?? false,
      apiKey: patch.apiKey ?? null,
      baseUrl: patch.baseUrl ?? 'https://openrouter.ai/api/v1',
      model: patch.model ?? 'qwen/qwen3-next-80b-a3b-instruct:free',
    },
    update: patch,
  });
  logger.info({ userId, enabled: patch.enabled }, 'Asistan yapılandırması güncellendi');
  return getConfig(userId);
}
