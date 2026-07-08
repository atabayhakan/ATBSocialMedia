import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { encryptSecret } from '../lib/crypto';

const router = Router();

router.get('/accounts', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const accounts = await prisma.socialAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(accounts.map((a: any) => ({ ...a, accessToken: undefined, refreshToken: undefined })));
});

router.post('/accounts', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const { platform, accountName, externalId, accessToken, refreshToken, expiresAt, meta } = req.body;
  const account = await prisma.socialAccount.create({
    data: {
      userId,
      platform,
      accountName,
      externalId,
      accessToken: encryptSecret(accessToken)!,
      refreshToken: encryptSecret(refreshToken),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      meta,
    },
  });
  res.status(201).json({ ...account, accessToken: undefined, refreshToken: undefined });
});

router.delete('/accounts/:id', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  // Sahiplik kısıtlı silme: yalnız kendi hesabını siler (IDOR koruması).
  const { count } = await prisma.socialAccount.deleteMany({
    where: { id: req.params.id, userId },
  });
  if (!count) return res.status(404).json({ error: 'Hesap bulunamadı' });
  res.status(204).end();
});

export default router;
