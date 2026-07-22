import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { encryptSecret, decryptSecret } from '../lib/crypto';

const router = Router();

const createAccountSchema = z.object({
  platform: z.enum(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'TELEGRAM', 'BLUESKY']),
  accountName: z.string().min(1),
  externalId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  meta: z.record(z.any()).optional(),
});

router.get('/accounts', async (req, res) => {
  const userId = req.userId!;
  const accounts = await prisma.socialAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(accounts.map((a: any) => ({ ...a, accessToken: undefined, refreshToken: undefined })));
});

function parseOptionalDate(d?: string | null): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

router.post('/accounts', async (req, res) => {
  const userId = req.userId!;
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { platform, accountName, externalId, accessToken, refreshToken, expiresAt, meta } = parsed.data;
  const account = await prisma.socialAccount.create({
    data: {
      userId,
      platform,
      accountName: accountName.trim(),
      externalId: externalId.trim(),
      accessToken: encryptSecret(accessToken.trim())!,
      refreshToken: encryptSecret(refreshToken?.trim()),
      expiresAt: parseOptionalDate(expiresAt),
      meta,
      active: true,
    },
  });
  res.status(201).json({ ...account, accessToken: undefined, refreshToken: undefined });
});

router.put('/accounts/:id', async (req, res) => {
  const userId = req.userId!;
  const { accountName, externalId, accessToken, refreshToken, expiresAt } = req.body;

  const data: Record<string, any> = {};
  if (accountName !== undefined) data.accountName = accountName.trim();
  if (externalId !== undefined) data.externalId = externalId.trim();
  if (accessToken) data.accessToken = encryptSecret(accessToken.trim());
  if (refreshToken) data.refreshToken = encryptSecret(refreshToken.trim());
  if (expiresAt !== undefined) data.expiresAt = parseOptionalDate(expiresAt);

  // Sahiplik kısıtlı güncelleme: yalnız kendi hesabını düzenler (IDOR koruması).
  const { count } = await prisma.socialAccount.updateMany({
    where: { id: req.params.id, userId },
    data,
  });
  if (!count) return res.status(404).json({ error: 'Hesap bulunamadı' });

  const account = await prisma.socialAccount.findUnique({ where: { id: req.params.id } });
  res.json({ ...account, accessToken: undefined, refreshToken: undefined });
});

router.delete('/accounts/:id', async (req, res) => {
  const userId = req.userId!;
  // Sahiplik kısıtlı silme: yalnız kendi hesabını siler (IDOR koruması).
  const { count } = await prisma.socialAccount.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (!count) return res.status(404).json({ error: 'Hesap bulunamadı' });
  res.status(204).end();
});

router.post('/accounts/:id/test', async (req, res) => {
  const userId = req.userId!;
  const account = await prisma.socialAccount.findFirst({ where: { id: req.params.id, userId } });
  if (!account) return res.status(404).json({ error: 'Hesap bulunamadı' });

  try {
    const token = decryptSecret(account.accessToken);
    if (!token) return res.status(400).json({ error: 'Token bulunamadı veya çözülemedi' });

    if (account.platform === 'INSTAGRAM' || account.platform === 'FACEBOOK') {
      const axios = (await import('axios')).default;
      const { data } = await axios.get(`https://graph.facebook.com/v20.0/${account.externalId}`, {
        params: { access_token: token, fields: 'id,name,username' },
        timeout: 10000,
      });
      return res.json({ ok: true, name: data.name || data.username || account.accountName });
    }
    res.json({ ok: true, name: account.accountName });
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e.message || 'Bağlantı testi başarısız';
    res.status(400).json({ error: msg });
  }
});

export default router;
