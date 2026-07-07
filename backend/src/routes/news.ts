import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { fetchAllSources } from '../services/newsFetcher';

const router = Router();

router.get('/', async (req, res) => {
  const used = req.query.used === 'true';
  const items = await prisma.newsItem.findMany({
    where: { used },
    include: { source: true },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  });
  res.json(items);
});

router.post('/fetch-all', async (_req, res) => {
  try {
    const result = await fetchAllSources();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
