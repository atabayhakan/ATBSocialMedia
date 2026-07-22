import { Router } from 'express';
import { z } from 'zod';
import * as strategy from '../services/strategy';

const router = Router();

const strategySchema = z.object({
  positioningStatement: z.string().optional(),
  targetAudience: z.string().optional(),
  voiceDos: z.array(z.string()).optional(),
  voiceDonts: z.array(z.string()).optional(),
  platformFlex: z.record(z.string()).optional(),
});

router.get('/', async (req, res) => {
  const data = await strategy.getStrategy(req.userId!);
  res.json(data);
});

router.put('/', async (req, res) => {
  const parsed = strategySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = await strategy.upsertStrategy(req.userId!, parsed.data);
  res.json(data);
});

router.post('/drift-check', async (req, res) => {
  try {
    const data = await strategy.runDriftCheck(req.userId!);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

const pillarSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetPercentage: z.number().int().min(1).max(100),
  topicBank: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

router.post('/pillars', async (req, res) => {
  const parsed = pillarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const pillar = await strategy.createPillar(req.userId!, parsed.data);
    res.status(201).json(pillar);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/pillars/:id', async (req, res) => {
  const parsed = pillarSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const pillar = await strategy.updatePillar(req.userId!, req.params.id, parsed.data);
    res.json(pillar);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

router.delete('/pillars/:id', async (req, res) => {
  try {
    await strategy.deletePillar(req.userId!, req.params.id);
    res.status(204).end();
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

const cadenceSchema = z.object({
  platform: z.enum(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'TELEGRAM', 'BLUESKY']),
  weekday: z.number().int().min(0).max(6),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  pillarId: z.string().optional(),
  active: z.boolean().default(true),
});

router.get('/cadence', async (req, res) => {
  const rules = await strategy.listCadenceRules(req.userId!);
  res.json(rules);
});

router.post('/cadence', async (req, res) => {
  const parsed = cadenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rule = await strategy.createCadenceRule(req.userId!, parsed.data);
  res.status(201).json(rule);
});

router.put('/cadence/:id', async (req, res) => {
  const parsed = cadenceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const rule = await strategy.updateCadenceRule(req.userId!, req.params.id, parsed.data);
    res.json(rule);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

router.delete('/cadence/:id', async (req, res) => {
  try {
    await strategy.deleteCadenceRule(req.userId!, req.params.id);
    res.status(204).end();
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

export default router;
