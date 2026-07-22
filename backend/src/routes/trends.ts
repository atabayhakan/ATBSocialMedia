import { Router } from 'express';
import { z } from 'zod';
import * as trends from '../services/trends';

const router = Router();

router.get('/', async (req, res) => {
  const signals = await trends.listTrends(req.userId!);
  res.json(signals);
});

router.post('/scan', async (req, res) => {
  const result = await trends.scanTrends(req.userId!);
  res.json(result);
});

const manualTrendSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sourceUrl: z.string().optional(),
});

router.post('/', async (req, res) => {
  const parsed = manualTrendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const signal = await trends.createManualTrend(req.userId!, parsed.data);
  res.status(201).json(signal);
});

router.post('/:id/draft', async (req, res) => {
  try {
    const post = await trends.draftFromTrend(req.userId!, req.params.id);
    res.status(201).json(post);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/briefing', async (req, res) => {
  const reports = await trends.listReports(req.userId!);
  res.json(reports);
});

const briefingSchema = z.object({
  type: z.enum(['FOUNDER_BRIEFING_DAILY', 'FOUNDER_BRIEFING_WEEKLY']),
});

router.post('/briefing/generate', async (req, res) => {
  const parsed = briefingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const report = await trends.generateBriefing(req.userId!, parsed.data.type);
  res.status(201).json(report);
});

export default router;
