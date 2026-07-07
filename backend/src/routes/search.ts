import { Router } from 'express';
import { searchAll } from '../services/search';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const q = (req.query.q || '').toString();
  if (q.trim().length < 2) return res.json({ results: [] });

  try {
    const results = await searchAll(userId, q);
    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
