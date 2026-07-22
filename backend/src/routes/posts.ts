import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { generatePostForUser, approvePost, publishToPlatform } from '../services/publisher';

const router = Router();

const postUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  hashtags: z.array(z.string()).optional(),
});

router.get('/', async (req, res) => {
  const userId = req.userId!;
  const status = req.query.status as string | undefined;
  const posts = await prisma.post.findMany({
    where: { userId, ...(status ? { status: status as any } : {}) },
    include: { targets: { include: { account: true } }, persona: true, niche: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(posts);
});

// Yalnız DRAFT/PENDING_APPROVAL durumundaki gönderiler düzenlenebilir — onaylanmış/
// zamanlanmış/yayınlanmış bir gönderiyi değiştirmek yarım-yayın karmaşasına yol açar
// (PostTarget'lar zaten eski içerikle oluşmuş olabilir).
router.put('/:id', async (req, res) => {
  const parsed = postUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const owned = await prisma.post.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!owned) return res.status(404).json({ error: 'Gönderi bulunamadı' });
  if (!['DRAFT', 'PENDING_APPROVAL'].includes(owned.status)) {
    return res.status(400).json({ error: 'Yalnız onay bekleyen taslaklar düzenlenebilir' });
  }

  const post = await prisma.post.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(post);
});

router.post('/generate', async (req, res) => {
  try {
    const userId = req.userId!;
    const post = await generatePostForUser(userId, { nicheId: req.body.nicheId });
    res.status(201).json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sahiplik kısıtlı: yalnız kendi gönderisini onaylar/reddeder/yayınlar (IDOR koruması).
router.post('/:id/approve', async (req, res) => {
  try {
    const owned = await prisma.post.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!owned) return res.status(404).json({ error: 'Gönderi bulunamadı' });
    const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined;
    const post = await approvePost(req.params.id, scheduledAt);
    res.json(post);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  const { count } = await prisma.post.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { status: 'REJECTED' },
  });
  if (!count) return res.status(404).json({ error: 'Gönderi bulunamadı' });
  // Henüz yayınlanmamış hedefleri de iptal et — aksi halde scheduler onları
  // reddedilmiş post'a rağmen yayınlamaya devam ederdi.
  await prisma.postTarget.updateMany({
    where: { postId: req.params.id, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'] } },
    data: { status: 'REJECTED' },
  });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  res.json(post);
});

router.post('/:id/publish', async (req, res) => {
  try {
    const owned = await prisma.post.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!owned) return res.status(404).json({ error: 'Gönderi bulunamadı' });
    if (owned.status === 'REJECTED') {
      return res.status(400).json({ error: 'Reddedilmiş gönderi yayınlanamaz' });
    }
    const targetId = req.body.targetId as string | undefined;
    if (targetId) {
      // targetId'nin bu (sahiplik doğrulanmış) gönderiye ait olduğunu doğrula —
      // aksi halde kullanıcı başka bir gönderinin/hesabın hedefini yayınlatabilirdi (IDOR).
      const target = await prisma.postTarget.findFirst({ where: { id: targetId, postId: owned.id } });
      if (!target) return res.status(404).json({ error: 'Hedef bulunamadı' });
      await publishToPlatform(owned.id, target.id);
    } else {
      const targets = await prisma.postTarget.findMany({ where: { postId: owned.id } });
      for (const t of targets) await publishToPlatform(owned.id, t.id);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
