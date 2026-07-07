import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const planSchema = z.object({
  name: z.string().min(1).max(120),
  method: z.enum(['UNILEVEL', 'BINARY', 'MATRIX', 'HYBRID']),
  width: z.number().int().min(1).max(10).default(5),
  depth: z.number().int().min(1).max(99).default(5),
  depthUnlimited: z.boolean().default(false),
  config: z.any().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

router.get('/', async (req, res) => {
  const userId = req.header('x-user-id');
  const items = await prisma.compensationPlan.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
});

router.get('/:id', async (req, res) => {
  const item = await prisma.compensationPlan.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Plan bulunamadı' });
  res.json(item);
});

router.post('/', async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.header('x-user-id') || 'demo-user';
  const plan = await prisma.compensationPlan.create({
    data: { ...parsed.data, userId },
  });
  res.status(201).json(plan);
});

router.put('/:id', async (req, res) => {
  const parsed = planSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const plan = await prisma.compensationPlan.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(plan);
});

router.delete('/:id', async (req, res) => {
  await prisma.compensationPlan.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
