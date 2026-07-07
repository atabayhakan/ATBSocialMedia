import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { generatePostForUser, approvePost, publishToPlatform } from '../services/publisher';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.header('x-user-id');
  const status = req.query.status as string | undefined;
  const posts = await prisma.post.findMany({
    where: { userId: userId || undefined, ...(status ? { status: status as any } : {}) },
    include: { targets: { include: { account: true } }, persona: true, niche: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(posts);
});

router.post('/generate', async (req, res) => {
  try {
    const userId = req.header('x-user-id') || req.body.userId;
    if (!userId) return res.status(400).json({ error: 'userId gerekli' });
    const post = await generatePostForUser(userId, { nicheId: req.body.nicheId });
    res.status(201).json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined;
    const post = await approvePost(req.params.id, scheduledAt);
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED' },
  });
  res.json(post);
});

router.post('/:id/publish', async (req, res) => {
  try {
    const targetId = req.body.targetId as string;
    if (targetId) {
      await publishToPlatform(req.params.id, targetId);
    } else {
      const targets = await prisma.postTarget.findMany({ where: { postId: req.params.id } });
      for (const t of targets) await publishToPlatform(req.params.id, t.id);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
