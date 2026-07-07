// İlk kurulum verisi: demo kullanıcı + varsayılan persona + Teknoloji nişi + 2 RSS kaynağı.
// Çalıştırma: cd backend && npx tsx prisma/seed.ts
// Idempotent'tir (upsert) — tekrar çalıştırmak güvenlidir.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: 'demo-user' },
    update: {},
    create: {
      id: 'demo-user',
      email: 'demo@atbsocialmedia.local',
      name: 'Demo Kullanıcı',
      role: 'OWNER',
      timezone: 'Europe/Istanbul',
      defaultMode: 'APPROVAL',
    },
  });

  await prisma.persona.upsert({
    where: { id: 'persona-default' },
    update: {},
    create: {
      id: 'persona-default',
      userId: user.id,
      name: 'ATB Asistan',
      tone: 'Samimi, profesyonel, enerjik, Türkçe doğal konuşma dili',
      language: 'tr',
      voiceRules:
        'Kısa ve öz cümleler kullan. Emoji kullanma. Rakamları yazıyla değil, rakamla yaz. Markdown kullanma.',
      forbiddenTopics: 'Politika, din, kişisel yorumlar',
      isDefault: true,
    },
  });

  const niche = await prisma.niche.upsert({
    where: { id: 'niche-tech' },
    update: {},
    create: {
      id: 'niche-tech',
      userId: user.id,
      name: 'Teknoloji',
      keywords: ['yapay zeka', 'teknoloji', 'startup', 'yazılım'],
      active: true,
    },
  });

  for (const src of [
    { id: 'src-techcrunch', url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
    { id: 'src-theverge', url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
  ]) {
    await prisma.newsSource.upsert({
      where: { id: src.id },
      update: {},
      create: {
        id: src.id,
        userId: user.id,
        nicheId: niche.id,
        type: 'RSS',
        url: src.url,
        name: src.name,
        language: 'en',
        active: true,
        intervalMin: 30,
      },
    });
  }

  console.log('✅ Seed tamamlandı: demo-user + persona + niş + 2 RSS kaynağı');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
