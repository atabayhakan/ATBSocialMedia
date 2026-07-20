import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

const personaSchema = z.object({
  name: z.string().min(1),
  tone: z.string().min(1),
  language: z.string().default('tr'),
  voiceRules: z.string().optional(),
  forbiddenTopics: z.string().optional(),
  isDefault: z.boolean().default(false),
});

router.get('/', async (req, res) => {
  const userId = req.userId!;
  const personas = await prisma.persona.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(personas);
});

router.post('/', async (req, res) => {
  const userId = req.userId!;
  const parsed = personaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.isDefault) {
    await prisma.persona.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const persona = await prisma.persona.create({
    data: { userId, ...parsed.data },
  });
  res.status(201).json(persona);
});

router.put('/:id', async (req, res) => {
  const userId = req.userId!;
  const owned = await prisma.persona.findFirst({ where: { id: req.params.id, userId } });
  if (!owned) return res.status(404).json({ error: 'Persona bulunamadı' });

  const parsed = personaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.isDefault) {
    await prisma.persona.updateMany({ where: { userId }, data: { isDefault: false } });
  }
  const persona = await prisma.persona.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(persona);
});

router.delete('/:id', async (req, res) => {
  const { count } = await prisma.persona.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  if (!count) return res.status(404).json({ error: 'Persona bulunamadı' });
  res.status(204).end();
});

export default router;
