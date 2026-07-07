import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/stats', async (_req, res) => {
  const [
    postCount,
    publishedCount,
    pendingCount,
    sourceCount,
    personaCount,
    accountCount,
    recentPosts,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.post.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.newsSource.count({ where: { active: true } }),
    prisma.persona.count(),
    prisma.socialAccount.count({ where: { active: true } }),
    prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { targets: true, persona: true },
    }),
  ]);

  const last7days = await prisma.post.groupBy({
    by: ['status'],
    _count: true,
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
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
  const userId = req.header('x-user-id');
  const [pending, failed, critical] = await Promise.all([
    prisma.post.findMany({
      where: { userId: userId || undefined, status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.postTarget.findMany({
      where: { status: 'FAILED', post: { userId: userId || undefined } },
      include: { post: true },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    }),
    prisma.whatsAppReply.findMany({
      where: { isCritical: true, createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

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
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ count: items.length, items: items.slice(0, 10) });
});

export default router;
