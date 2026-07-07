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

export default router;
