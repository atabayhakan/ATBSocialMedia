import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, signToken } from '../lib/auth';
import { requireAuth } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

function publicUser(user: { id: string; email: string; name: string | null; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// İlk kurulum: sistemde henüz şifre belirlenmiş kimse yoksa herkese açık,
// sonrasında kapanır (self-hosted uygulamalarda standart "ilk çalıştırma" akışı).
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const anyPasswordSet = await prisma.user.count({ where: { passwordHash: { not: null } } });
  if (anyPasswordSet > 0) return res.status(403).json({ error: 'Kurulum zaten tamamlanmış' });

  const passwordHash = await hashPassword(parsed.data.password);
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: parsed.data.name ?? existing.name },
      })
    : await prisma.user.create({
        data: { email: parsed.data.email, name: parsed.data.name, passwordHash, role: 'OWNER' },
      });

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json(publicUser(user));
});

export default router;
