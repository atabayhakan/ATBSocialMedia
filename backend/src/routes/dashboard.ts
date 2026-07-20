import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/stats', async (req, res) => {
  // Tüm sayımlar ve son gönderiler yalnız bu kullanıcıya ait olmalı — aksi halde
  // dashboard başka kiracıların gönderi içeriğini sızdırır.
  const userId = req.userId;
  const [
    postCount,
    publishedCount,
    pendingCount,
    sourceCount,
    personaCount,
    accountCount,
    recentPosts,
  ] = await Promise.all([
    prisma.post.count({ where: { userId } }),
    prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
    prisma.post.count({ where: { userId, status: 'PENDING_APPROVAL' } }),
    prisma.newsSource.count({ where: { userId, active: true } }),
    prisma.persona.count({ where: { userId } }),
    prisma.socialAccount.count({ where: { userId, active: true } }),
    prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { targets: true, persona: true },
    }),
  ]);

  const last7days = await prisma.post.groupBy({
    by: ['status'],
    _count: true,
    where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  res.json({
    postCount,
    publishedCount,
    pendingCount,
    sourceCount,
    personaCount,
    accountCount,
    last7days,
    recentPosts,
  });
});

router.get('/notifications', async (req, res) => {
  const userId = req.userId;
  // Kritik WhatsApp yanıtlarını yalnız bu kullanıcının config'ine kısıtla (mock store
  // nested relation filtresi desteklemediği için configId üzerinden filtreliyoruz).
  const waCfg = await prisma.whatsAppConfig.findFirst({ where: { userId } });
  const [pending, failed, critical, expiringAccounts] = await Promise.all([
    prisma.post.findMany({
      where: { userId, status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.postTarget.findMany({
      where: { status: 'FAILED', post: { userId } },
      include: { post: true },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    }),
    waCfg
      ? prisma.whatsAppReply.findMany({
          where: {
            configId: waCfg.id,
            isCritical: true,
            createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    // Süresi ayarlı, aktif hesaplar (eşik filtresi aşağıda JS'te uygulanır —
    // mock store Prisma'nın lte/top-level NOT operatörlerini desteklemiyor).
    prisma.socialAccount.findMany({
      where: { userId, active: true, expiresAt: { not: null } },
      orderBy: { expiresAt: 'asc' },
    }),
  ]);

  const expiryThreshold = Date.now() + 24 * 60 * 60 * 1000;
  const expiringSoon = expiringAccounts
    .filter((a: any) => new Date(a.expiresAt).getTime() <= expiryThreshold)
    .slice(0, 5);

  const items = [
    ...pending.map((p: any) => ({
      type: 'PENDING' as const,
      title: 'Onay bekleyen gönderi',
      detail: p.title,
      href: '/dashboard/calendar',
      createdAt: p.createdAt,
    })),
    ...failed.map((t: any) => ({
      type: 'FAILED' as const,
      title: `${t.platform} yayını başarısız`,
      detail: t.error || t.post?.title || '',
      href: '/dashboard/calendar',
      createdAt: t.publishedAt || t.post?.updatedAt || new Date(),
    })),
    ...critical.map((r: any) => ({
      type: 'CRITICAL_WA' as const,
      title: 'Kritik WhatsApp mesajı',
      detail: r.incomingBody,
      href: '/dashboard/whatsapp',
      createdAt: r.createdAt,
    })),
    ...expiringSoon.map((a: any) => ({
      type: 'ACCOUNT_EXPIRING' as const,
      title:
        new Date(a.expiresAt).getTime() < Date.now()
          ? `${a.platform} bağlantısının süresi doldu`
          : `${a.platform} bağlantısının süresi yakında doluyor`,
      detail: a.accountName,
      href: '/dashboard/social',
      createdAt: a.expiresAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ count: items.length, items: items.slice(0, 10) });
});

export default router;
