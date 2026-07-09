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
      active: true,
    },
  });
  res.status(201).json({ ...account, accessToken: undefined, refreshToken: undefined });
});

router.put('/accounts/:id', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const { accountName, externalId, accessToken, refreshToken, expiresAt } = req.body;

  // Boş bırakılan accessToken/refreshToken mevcut değeri korur (kullanıcı yalnızca
  // ismi/süreyi güncelleyebilsin ya da token'ı tekrar yazmak zorunda kalmasın).
  const data: Record<string, any> = {};
  if (accountName !== undefined) data.accountName = accountName;
  if (externalId !== undefined) data.externalId = externalId;
  if (accessToken) data.accessToken = encryptSecret(accessToken);
  if (refreshToken) data.refreshToken = encryptSecret(refreshToken);
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

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
