import { Router } from 'express';
import { z } from 'zod';
import * as crisis from '../services/crisis';

const router = Router();

router.get('/', async (req, res) => {
  const events = await crisis.listCrisisEvents(req.userId!);
  res.json(events);
});

router.post('/:id/apology', async (req, res) => {
  try {
    const event = await crisis.draftApology(req.userId!, req.params.id);
    res.json(event);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const event = await crisis.resolveCrisis(req.userId!, req.params.id);
    res.json(event);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

router.get('/impersonators', async (req, res) => {
  const reports = await crisis.listImpersonatorReports(req.userId!);
  res.json(reports);
});

const impersonatorSchema = z.object({
  platform: z.enum(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'TELEGRAM', 'BLUESKY']),
  impersonatingHandle: z.string().min(1),
});

router.post('/impersonators', async (req, res) => {
  const parsed = impersonatorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const report = await crisis.reportImpersonator(req.userId!, parsed.data);
  res.status(201).json(report);
});

const impersonatorStatusSchema = z.object({ status: z.enum(['DETECTED', 'REPORTED', 'RESOLVED', 'DISMISSED']) });

router.put('/impersonators/:id/status', async (req, res) => {
  const parsed = impersonatorStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const report = await crisis.updateImpersonatorStatus(req.userId!, req.params.id, parsed.data.status);
    res.json(report);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

export default router;
