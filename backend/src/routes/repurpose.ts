import { Router } from 'express';
import { z } from 'zod';
import * as repurpose from '../services/repurpose';

const router = Router();

const repurposeSchema = z.object({
  type: z.enum(['BLOG', 'PODCAST_TRANSCRIPT', 'NEWSLETTER', 'MANUAL_TEXT']),
  title: z.string().min(1),
  rawText: z.string().min(20, 'Metin en az 20 karakter olmalı'),
  sourceUrl: z.string().optional(),
});

router.get('/', async (req, res) => {
  const sources = await repurpose.listRepurposeSources(req.userId!);
  res.json(sources);
});

router.post('/', async (req, res) => {
  const parsed = repurposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await repurpose.repurposeText(req.userId!, parsed.data);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
