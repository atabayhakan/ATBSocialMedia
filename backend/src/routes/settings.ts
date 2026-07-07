import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  res.json({
    defaultMode: user.defaultMode,
    notifications: {
      telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    },
  });
});

const settingsSchema = z.object({
  defaultMode: z.enum(['APPROVAL', 'FULLY_AUTONOMOUS']),
});

router.put('/', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { defaultMode: parsed.data.defaultMode },
  });
  res.json({ defaultMode: user.defaultMode });
});

export default router;
