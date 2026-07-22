import { Router } from 'express';
import { z } from 'zod';
import * as engagement from '../services/engagement';

const router = Router();

router.get('/', async (req, res) => {
  const items = await engagement.listEngagementItems(req.userId!, {
    status: req.query.status as string | undefined,
    kind: req.query.kind as string | undefined,
  });
  res.json(items);
});

const createSchema = z.object({
  platform: z.enum(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'TELEGRAM', 'BLUESKY']),
  kind: z.enum(['DM', 'MENTION', 'COMMENT']),
  authorHandle: z.string().min(1),
  content: z.string().min(1),
  permalink: z.string().optional(),
  receivedAt: z.string().optional(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await engagement.createEngagementItem(req.userId!, parsed.data);
  res.status(201).json(item);
});

router.post('/:id/draft-reply', async (req, res) => {
  try {
    const item = await engagement.draftReply(req.userId!, req.params.id);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

const replySchema = z.object({ replyBody: z.string().optional() });

router.post('/:id/reply', async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await engagement.markReplied(req.userId!, req.params.id, parsed.data.replyBody);
    res.json(item);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

const statusSchema = z.object({ status: z.enum(['NEW', 'TRIAGED', 'REPLIED', 'IGNORED', 'ESCALATED']) });

router.put('/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const item = await engagement.updateEngagementStatus(req.userId!, req.params.id, parsed.data.status);
    res.json(item);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

const escalateSchema = z.object({
  title: z.string().min(1),
  triageCategory: z.enum([
    'LEGITIMATE_COMPLAINT',
    'FAIR_CRITICISM',
    'MISUNDERSTANDING',
    'TROLL',
    'COORDINATED_ATTACK',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});

router.post('/:id/escalate', async (req, res) => {
  const parsed = escalateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const crisis = await engagement.escalateToCrisis(req.userId!, req.params.id, parsed.data);
    res.status(201).json(crisis);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
