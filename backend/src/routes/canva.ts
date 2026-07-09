import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { getAuthorizeUrl, exchangeCodeForToken, listTemplates, fillCanvaTemplate } from '../services/canva';

const router = Router();

router.get('/connect', (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  // Eksik env ile Canva'nın kendi (kafa karıştırıcı) 400 hata sayfasına
  // yönlendirmek yerine burada anlaşılır bir hata döndür.
  if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_REDIRECT_URI) {
    return res.status(400).json({
      error: 'Canva entegrasyonu henüz yapılandırılmamış (CANVA_CLIENT_ID / CANVA_REDIRECT_URI sunucu .env dosyasında boş).',
    });
  }
  const state = crypto.randomBytes(16).toString('hex');
  res.json({ url: getAuthorizeUrl(state), state });
});

router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const userId = req.header('x-user-id') || (req.query.state as string);
    if (!code || !userId) return res.status(400).send('Geçersiz istek');
    await exchangeCodeForToken(code as string, userId as string);
    res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/dashboard/canva?connected=1`);
  } catch (e: any) {
    res.status(500).send(`Canva bağlantı hatası: ${e.message}`);
  }
});

router.get('/status', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const cfg = await prisma.canvaConfig.findUnique({ where: { userId } });
  res.json({ connected: !!cfg, expiresAt: cfg?.expiresAt, defaultTemplateId: cfg?.defaultTemplateId || null });
});

router.put('/default-template', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const templateId = (req.body?.templateId ?? null) as string | null;
  const cfg = await prisma.canvaConfig.findUnique({ where: { userId } });
  if (!cfg) return res.status(400).json({ error: 'Önce Canva hesabını bağla' });
  const updated = await prisma.canvaConfig.update({
    where: { userId },
    data: { defaultTemplateId: templateId },
  });
  res.json({ defaultTemplateId: updated.defaultTemplateId });
});

router.get('/templates', async (req, res) => {
  try {
    const userId = req.header('x-user-id');
    if (!userId) return res.status(400).json({ error: 'userId gerekli' });
    const templates = await listTemplates(userId);
    res.json(templates);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/fill', async (req, res) => {
  try {
    const userId = req.header('x-user-id');
    if (!userId) return res.status(400).json({ error: 'userId gerekli' });
    const result = await fillCanvaTemplate(userId, req.body, req.body.templateId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
