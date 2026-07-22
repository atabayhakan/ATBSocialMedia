import { Router } from 'express';
import { z } from 'zod';
import { suggestHooks, suggestCTA } from '../services/contentTools';

const router = Router();

const inputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

router.post('/hooks', async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const hooks = await suggestHooks(parsed.data.title, parsed.data.body);
  res.json(hooks);
});

router.post('/cta', async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const cta = await suggestCTA(parsed.data.title, parsed.data.body);
  res.json(cta);
});

export default router;
