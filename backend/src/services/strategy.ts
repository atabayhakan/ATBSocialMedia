// Marka stratejisi: pozisyonlama + ses rehberi (BrandStrategy, tekil/singleton),
// içerik sütunları (ContentPillar) ve yayın sıklığı matrisi (CadenceRule).
// BrandStrategy'nin Persona'dan farkı: Persona içerik üretimi anındaki ses
// VARYANTI, BrandStrategy tüm personaların uyması gereken üst-seviye marka kimliği.
import { prisma } from '../lib/prisma';
import { chatJson } from './ai';

export async function getStrategy(userId: string) {
  return prisma.brandStrategy.findUnique({
    where: { userId },
    include: { pillars: { orderBy: { createdAt: 'asc' } } },
  });
}

export interface StrategyInput {
  positioningStatement?: string;
  targetAudience?: string;
  voiceDos?: string[];
  voiceDonts?: string[];
  platformFlex?: Record<string, string>;
}

export async function upsertStrategy(userId: string, data: StrategyInput) {
  return prisma.brandStrategy.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
    include: { pillars: { orderBy: { createdAt: 'asc' } } },
  });
}

async function requireOwnStrategy(userId: string) {
  const strategy = await prisma.brandStrategy.findUnique({ where: { userId } });
  if (!strategy) throw new Error('Önce marka stratejisi oluşturulmalı');
  return strategy;
}

export interface PillarInput {
  name: string;
  description?: string;
  targetPercentage: number;
  topicBank: string[];
  active?: boolean;
}

export async function createPillar(userId: string, data: PillarInput) {
  const strategy = await requireOwnStrategy(userId);
  return prisma.contentPillar.create({ data: { strategyId: strategy.id, ...data } });
}

async function requireOwnPillar(userId: string, pillarId: string) {
  const pillar = await prisma.contentPillar.findUnique({ where: { id: pillarId } });
  if (!pillar) throw new Error('Sütun bulunamadı');
  const strategy = await prisma.brandStrategy.findUnique({ where: { id: pillar.strategyId } });
  if (!strategy || strategy.userId !== userId) throw new Error('Sütun bulunamadı');
  return pillar;
}

export async function updatePillar(userId: string, pillarId: string, data: Partial<PillarInput>) {
  await requireOwnPillar(userId, pillarId);
  return prisma.contentPillar.update({ where: { id: pillarId }, data });
}

export async function deletePillar(userId: string, pillarId: string) {
  await requireOwnPillar(userId, pillarId);
  await prisma.contentPillar.delete({ where: { id: pillarId } });
}

export interface CadenceInput {
  platform: string;
  weekday: number;
  timeOfDay: string;
  pillarId?: string;
  active?: boolean;
}

export async function listCadenceRules(userId: string) {
  return prisma.cadenceRule.findMany({ where: { userId }, orderBy: [{ weekday: 'asc' }, { timeOfDay: 'asc' }] });
}

export async function createCadenceRule(userId: string, data: CadenceInput) {
  return prisma.cadenceRule.create({ data: { userId, ...data } });
}

export async function updateCadenceRule(userId: string, id: string, data: Partial<CadenceInput>) {
  const { count } = await prisma.cadenceRule.updateMany({ where: { id, userId }, data });
  if (!count) throw new Error('Kural bulunamadı');
  return prisma.cadenceRule.findUnique({ where: { id } });
}

export async function deleteCadenceRule(userId: string, id: string) {
  const { count } = await prisma.cadenceRule.deleteMany({ where: { id, userId } });
  if (!count) throw new Error('Kural bulunamadı');
}

// Son gönderileri mevcut ses kurallarına karşı denetler, sapma varsa kısa
// maddeler halinde bulgu üretir. AI kapalıysa/başarısızsa nazik bir "yetersiz
// veri" notu döner — sessizce eski driftNotes'u yanlış bilgiyle ezmez.
export async function runDriftCheck(userId: string) {
  const strategy = await requireOwnStrategy(userId);
  const recentPosts = await prisma.post.findMany({
    where: { userId, status: { in: ['PUBLISHED', 'APPROVED', 'SCHEDULED'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!recentPosts.length) {
    const driftNotes = 'Henüz denetlenecek yeterli gönderi yok.';
    return prisma.brandStrategy.update({
      where: { userId },
      data: { driftNotes, driftCheckedAt: new Date() },
    });
  }

  const prompt = `Sen bir marka sesi denetçisisin. Aşağıdaki marka ses kurallarına göre son gönderileri değerlendir.

Pozisyonlama: ${strategy.positioningStatement || '(belirtilmemiş)'}
Yapılması gerekenler: ${strategy.voiceDos.join('; ') || '(belirtilmemiş)'}
Yapılmaması gerekenler: ${strategy.voiceDonts.join('; ') || '(belirtilmemiş)'}

Son gönderiler:
${recentPosts.map((p: any, i: number) => `${i + 1}. ${p.title}\n${p.body.slice(0, 300)}`).join('\n\n')}

Görev: Kurallardan sapan kalıpları (varsa) 3-5 kısa madde halinde tespit et. Sapma yoksa "Belirgin bir sapma tespit edilmedi." yaz.
Sadece şu şemada JSON döndür: {"findings": "..."}`;

  const parsed = await chatJson(prompt, 0.4);
  const driftNotes =
    typeof parsed?.findings === 'string' && parsed.findings.trim()
      ? parsed.findings.trim()
      : 'AI denetimi şu an kullanılamıyor — daha sonra tekrar deneyin.';

  return prisma.brandStrategy.update({
    where: { userId },
    data: { driftNotes, driftCheckedAt: new Date() },
  });
}
