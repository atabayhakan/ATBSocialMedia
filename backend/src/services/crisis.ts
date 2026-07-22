// Escalate edilmiş EngagementItem'lardan doğan kriz durumlarını yönetir: özür taslağı,
// çözüldü işaretleme, sahte hesap (impersonator) takibi.
import { prisma } from '../lib/prisma';
import { chatJson } from './ai';

export async function listCrisisEvents(userId: string) {
  return prisma.crisisEvent.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function draftApology(userId: string, crisisId: string) {
  const crisis = await prisma.crisisEvent.findFirst({ where: { id: crisisId, userId } });
  if (!crisis) throw new Error('Kriz bulunamadı');
  const persona = await prisma.persona.findFirst({ where: { userId, isDefault: true } });
  if (!persona) throw new Error('Aktif persona bulunamadı');

  const prompt = `Sen "${persona.name}" adlı markanın sözcüsüsün. Aşağıdaki durum için özür/düzeltme metni yaz.

Durum: ${crisis.title}
Triyaj kategorisi: ${crisis.triageCategory}
Şiddet: ${crisis.severity}
Ton: ${persona.tone}

Kurallar:
- Doğrudan ve net ol — "üzgünüz ama..." gibi kaçamak ("conditional apology") dili KULLANMA.
- Sorumluluğu kabul et, ne yapılacağını söyle.
- 400-700 karakter.

Sadece şu şemada JSON döndür: {"apology": "..."}`;

  const parsed = await chatJson(prompt, 0.5);
  const apologyDraft =
    typeof parsed?.apology === 'string' && parsed.apology.trim()
      ? parsed.apology.trim()
      : 'Bu konuda özür dileriz. Durumu inceliyoruz ve en kısa sürede düzeltici adım atacağız. (AI şu an kullanılamıyor — bu taslağı elle düzenleyin.)';

  return prisma.crisisEvent.update({ where: { id: crisisId }, data: { apologyDraft } });
}

export async function resolveCrisis(userId: string, crisisId: string) {
  const { count } = await prisma.crisisEvent.updateMany({
    where: { id: crisisId, userId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
  if (!count) throw new Error('Kriz bulunamadı');
  return prisma.crisisEvent.findUnique({ where: { id: crisisId } });
}

export interface ImpersonatorInput {
  platform: string;
  impersonatingHandle: string;
}

export async function reportImpersonator(userId: string, input: ImpersonatorInput) {
  return prisma.impersonatorReport.create({
    data: { userId, platform: input.platform as any, impersonatingHandle: input.impersonatingHandle },
  });
}

export async function listImpersonatorReports(userId: string) {
  return prisma.impersonatorReport.findMany({ where: { userId }, orderBy: { detectedAt: 'desc' }, take: 50 });
}

export async function updateImpersonatorStatus(userId: string, id: string, status: string) {
  const { count } = await prisma.impersonatorReport.updateMany({ where: { id, userId }, data: { status } });
  if (!count) throw new Error('Kayıt bulunamadı');
  return prisma.impersonatorReport.findUnique({ where: { id } });
}
