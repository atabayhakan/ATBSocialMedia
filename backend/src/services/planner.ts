// CadenceRule'ları (Faz 1) somut, tarihli takvim slotlarına çevirir. Slot "doldurma"
// (bir slotu gerçek bir gönderiye bağlama) bilinçli olarak burada yok — bkz.
// CalendarSlot model yorumu (schema.prisma).
import { prisma } from '../lib/prisma';

const DAYS_AHEAD = 14;

function nextOccurrences(weekday: number, timeOfDay: string, daysAhead: number): Date[] {
  const [hh, mm] = timeOfDay.split(':').map(Number);
  const now = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (d.getDay() !== weekday) continue;
    d.setHours(hh, mm, 0, 0);
    if (d.getTime() > now.getTime()) dates.push(d);
  }
  return dates;
}

export async function generateSlotsFromCadence(userId: string) {
  const rules = await prisma.cadenceRule.findMany({ where: { userId, active: true } });
  if (!rules.length) return { created: 0 };

  const windowEnd = new Date(Date.now() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const existing = await prisma.calendarSlot.findMany({
    where: { userId, scheduledFor: { gte: new Date(), lte: windowEnd } },
  });
  const existingKeys = new Set(existing.map((s: any) => `${s.platform}|${new Date(s.scheduledFor).getTime()}`));

  const candidates: any[] = [];
  for (const rule of rules) {
    for (const date of nextOccurrences(rule.weekday, rule.timeOfDay, DAYS_AHEAD)) {
      const key = `${rule.platform}|${date.getTime()}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key); // aynı çalıştırma içinde de tekrarı önle
      candidates.push({
        userId,
        platform: rule.platform,
        scheduledFor: date,
        pillarId: rule.pillarId,
        status: 'OPEN',
      });
    }
  }

  if (!candidates.length) return { created: 0 };
  await prisma.calendarSlot.createMany({ data: candidates });
  return { created: candidates.length };
}

export async function listSlots(userId: string, opts?: { from?: Date; to?: Date }) {
  const from = opts?.from || new Date();
  const to = opts?.to || new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  const slots = await prisma.calendarSlot.findMany({
    where: { userId, scheduledFor: { gte: from, lte: to } },
    orderBy: { scheduledFor: 'asc' },
  });

  const pillarIds = [...new Set(slots.map((s: any) => s.pillarId).filter(Boolean))];
  const pillars = pillarIds.length
    ? await prisma.contentPillar.findMany({ where: { id: { in: pillarIds as string[] } } })
    : [];
  const pillarNameById = new Map(pillars.map((p: any) => [p.id, p.name]));

  return slots.map((s: any) => ({ ...s, pillarName: s.pillarId ? pillarNameById.get(s.pillarId) || null : null }));
}

export async function deleteSlot(userId: string, slotId: string) {
  const { count } = await prisma.calendarSlot.deleteMany({ where: { id: slotId, userId } });
  if (!count) throw new Error('Slot bulunamadı');
}

// scheduler.ts'in haftalık cron'u tarafından çağrılır — tek-kiracılı bugün için
// tek kullanıcıyı kapsar, çoklu-kiracı senaryosuna da hazırdır.
export async function generateSlotsForAllUsers() {
  const users = await prisma.user.findMany({ select: { id: true } });
  let total = 0;
  for (const u of users) {
    const { created } = await generateSlotsFromCadence(u.id);
    total += created;
  }
  return total;
}
