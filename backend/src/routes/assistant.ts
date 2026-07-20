import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { chat, buildDiagnosticReport, getConfig, updateConfig } from '../services/assistant';

const router = Router();

router.post('/chat', async (req, res) => {
  const userId = req.userId!;
  const message = (req.body?.message || '').toString().trim();
  if (!message) return res.status(400).json({ error: 'message gerekli' });
  if (message.length > 4000) return res.status(400).json({ error: 'Mesaj çok uzun (max 4000)' });

  try {
    const result = await chat(userId, message);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', async (req, res) => {
  const userId = req.userId!;
  const messages = await prisma.assistantMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(messages.reverse());
});

router.delete('/history', async (req, res) => {
  const userId = req.userId!;
  await prisma.assistantMessage.deleteMany({ where: { userId } });
  res.status(204).end();
});

router.get('/config', async (req, res) => {
  const userId = req.userId!;
  res.json(await getConfig(userId));
});

const configSchema = z.object({
  enabled: z.boolean().optional(),
  apiKey: z.string().max(300).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().min(1).max(200).optional(),
});

router.put('/config', async (req, res) => {
  const userId = req.userId!;
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await updateConfig(userId, parsed.data));
});

router.get('/report', async (req, res) => {
  const userId = req.userId!;
  try {
    const report = await buildDiagnosticReport(userId);
    res.type('text/markdown').send(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
