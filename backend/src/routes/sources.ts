import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { fetchSingleSource } from '../services/newsFetcher';

const router = Router();

const sourceSchema = z.object({
  type: z.enum(['RSS', 'WEB_SCRAPE', 'API']),
  url: z.string().url(),
  name: z.string().min(1),
  language: z.string().default('en'),
  targetLanguage: z.string().min(2).max(5).optional(), // boş = genel yayın dili
  nicheId: z.string().optional(),
  intervalMin: z.number().int().min(5).default(30),
});

router.get('/', async (req, res) => {
  const userId = req.userId!;
  const sources = await prisma.newsSource.findMany({
    where: { userId },
    include: { niche: true, _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sources);
});

router.post('/', async (req, res) => {
  const userId = req.userId!;
  const parsed = sourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const source = await prisma.newsSource.create({
    data: { userId, ...parsed.data },
  });
  res.status(201).json(source);
});

// Sahiplik kısıtlı: yalnız kendi kaynağını yeniler/siler (IDOR koruması).
router.post('/:id/refresh', async (req, res) => {
  try {
    const owned = await prisma.newsSource.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!owned) return res.status(404).json({ error: 'Kaynak bulunamadı' });
    const result = await fetchSingleSource(req.params.id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { count } = await prisma.newsSource.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (!count) return res.status(404).json({ error: 'Kaynak bulunamadı' });
  res.status(204).end();
});

export default router;
