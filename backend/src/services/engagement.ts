// v1: gerçek zamanlı platform okuma erişimi yok — DM/mention/yorum manuel-paste ile
// girilir, AI otomatik triyaj eder (kategori/öncelik/sentiment) ve yanıt taslağı önerir.
import { prisma } from '../lib/prisma';
import { chatJson } from './ai';
import { notifyCritical } from './notifier';

interface TriageResult {
  category?: string;
  priority: string;
  sentiment: string;
}

function clampEnum(value: any, allowed: string[], fallback: string): string {
  const upper = typeof value === 'string' ? value.toUpperCase() : '';
  return allowed.includes(upper) ? upper : fallback;
}

async function triage(kind: string, content: string): Promise<TriageResult> {
  const isDm = kind === 'DM';
  const prompt = isDm
    ? `Sen bir sosyal medya gelen kutusu triyaj asistanısın. Aşağıdaki DM'i şu şemada JSON olarak sınıflandır:
{"category": "SALES|SUPPORT|COLLABORATION|SPAM|PERSONAL|PRESS", "priority": "LOW|MEDIUM|HIGH|URGENT", "sentiment": "POSITIVE|NEUTRAL|NEGATIVE"}

Mesaj: ${content.slice(0, 1000)}`
    : `Sen bir sosyal medya gelen kutusu triyaj asistanısın. Aşağıdaki ${
        kind === 'MENTION' ? 'marka etiketlemesini' : 'yorumu'
      } şu şemada JSON olarak sınıflandır:
{"priority": "LOW|MEDIUM|HIGH|URGENT", "sentiment": "POSITIVE|NEUTRAL|NEGATIVE"}

Metin: ${content.slice(0, 1000)}`;

  const parsed = await chatJson(prompt, 0.3);
  const priority = clampEnum(parsed?.priority, ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 'MEDIUM');
  const sentiment = clampEnum(parsed?.sentiment, ['POSITIVE', 'NEUTRAL', 'NEGATIVE'], 'NEUTRAL');
  const category = isDm
    ? clampEnum(parsed?.category, ['SALES', 'SUPPORT', 'COLLABORATION', 'SPAM', 'PERSONAL', 'PRESS'], 'SUPPORT')
    : undefined;
  return { category, priority, sentiment };
}

function computeSlaDueAt(priority: string): Date | null {
  if (priority === 'URGENT') return new Date(Date.now() + 2 * 60 * 60 * 1000);
  if (priority === 'HIGH') return new Date(Date.now() + 4 * 60 * 60 * 1000);
  if (priority === 'MEDIUM') return new Date(Date.now() + 24 * 60 * 60 * 1000);
  return null;
}

export interface CreateEngagementInput {
  platform: string;
  kind: string;
  authorHandle: string;
  content: string;
  permalink?: string;
  receivedAt?: string;
}

export async function createEngagementItem(userId: string, input: CreateEngagementInput) {
  const result = await triage(input.kind, input.content);
  return prisma.engagementItem.create({
    data: {
      userId,
      platform: input.platform as any,
      kind: input.kind as any,
      category: result.category,
      priority: result.priority,
      sentiment: result.sentiment,
      authorHandle: input.authorHandle,
      content: input.content,
      permalink: input.permalink,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      slaDueAt: computeSlaDueAt(result.priority),
    },
  });
}

export async function listEngagementItems(userId: string, opts?: { status?: string; kind?: string }) {
  return prisma.engagementItem.findMany({
    where: {
      userId,
      ...(opts?.status ? { status: opts.status as any } : {}),
      ...(opts?.kind ? { kind: opts.kind as any } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });
}

export async function draftReply(userId: string, itemId: string) {
  const item = await prisma.engagementItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('Kayıt bulunamadı');
  const persona = await prisma.persona.findFirst({ where: { userId, isDefault: true } });
  if (!persona) throw new Error('Aktif persona bulunamadı');

  const kindLabel = item.kind === 'DM' ? 'DM' : item.kind === 'MENTION' ? 'marka etiketlemesine' : 'yoruma';
  const prompt = `Sen "${persona.name}" adlı bir sosyal medya yöneticisisin. Aşağıdaki ${kindLabel}${
    item.category ? ` (kategori: ${item.category})` : ''
  } kısa, doğal bir yanıt taslağı yaz.

Ton: ${persona.tone}
${persona.voiceRules ? `Ek kurallar: ${persona.voiceRules}` : ''}

Sadece şu şemada JSON döndür: {"reply": "..."}

Gelen mesaj: ${item.content}`;

  const parsed = await chatJson(prompt, 0.6);
  const replyBody =
    typeof parsed?.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Merhaba, mesajınız için teşekkürler — en kısa sürede döneceğiz.';

  return prisma.engagementItem.update({
    where: { id: itemId },
    data: { replyBody, status: item.status === 'NEW' ? 'TRIAGED' : item.status },
  });
}

export async function markReplied(userId: string, itemId: string, replyBody?: string) {
  const { count } = await prisma.engagementItem.updateMany({
    where: { id: itemId, userId },
    data: { status: 'REPLIED', repliedAt: new Date(), ...(replyBody ? { replyBody } : {}) },
  });
  if (!count) throw new Error('Kayıt bulunamadı');
  return prisma.engagementItem.findUnique({ where: { id: itemId } });
}

export async function updateEngagementStatus(userId: string, itemId: string, status: string) {
  const { count } = await prisma.engagementItem.updateMany({
    where: { id: itemId, userId },
    data: { status: status as any },
  });
  if (!count) throw new Error('Kayıt bulunamadı');
  return prisma.engagementItem.findUnique({ where: { id: itemId } });
}

export interface EscalateInput {
  title: string;
  triageCategory: string;
  severity: string;
}

export async function escalateToCrisis(userId: string, itemId: string, input: EscalateInput) {
  const item = await prisma.engagementItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('Kayıt bulunamadı');

  const crisis = await prisma.crisisEvent.create({
    data: { userId, title: input.title, triageCategory: input.triageCategory, severity: input.severity },
  });
  await prisma.engagementItem.update({
    where: { id: itemId },
    data: { crisisEventId: crisis.id, status: 'ESCALATED' },
  });

  if (input.severity === 'HIGH' || input.severity === 'CRITICAL') {
    await notifyCritical({
      title: `Kriz: ${input.title}`,
      body: `${item.authorHandle}: ${item.content}\n\nŞiddet: ${input.severity}`,
    }).catch(() => false);
  }

  return crisis;
}
