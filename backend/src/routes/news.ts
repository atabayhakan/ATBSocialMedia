import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { fetchAllSources } from '../services/newsFetcher';

const router = Router();

router.get('/', async (req, res) => {
  const used = req.query.used === 'true';
  // Yalnız bu kullanıcının kaynaklarından gelen haberler (NewsItem→source→userId).
  // Nested relation filtresi mock store'da çalışmadığı için sourceId listesiyle kısıtlıyoruz.
  const sources = await prisma.newsSource.findMany({ where: { userId: req.userId } });
  const sourceIds = sources.map((s: any) => s.id);
  if (sourceIds.length === 0) return res.json([]);
  const items = await prisma.newsItem.findMany({
    where: { used, sourceId: { in: sourceIds } },
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
