import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { env } from '../lib/env';
import { getAuthorizeUrl, exchangeCodeForToken, generatePkce, listTemplates, fillCanvaTemplate } from '../services/canva';

const router = Router();

const OAUTH_STATE_TTL_SEC = 600; // OAuth akışını tamamlamak için 10 dakika yeterli

router.get('/connect', async (req, res) => {
  const userId = req.userId!;
  // Eksik env ile Canva'nın kendi (kafa karıştırıcı) 400 hata sayfasına
  // yönlendirmek yerine burada anlaşılır bir hata döndür.
  if (!process.env.CANVA_CLIENT_ID || !process.env.CANVA_REDIRECT_URI) {
    return res.status(400).json({
      error: 'Canva entegrasyonu henüz yapılandırılmamış (CANVA_CLIENT_ID / CANVA_REDIRECT_URI sunucu .env dosyasında boş).',
    });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = generatePkce();
  // Callback isteği (Canva'nın tarayıcıyı yönlendirdiği istek) bizim oturum
  // token'ımızı taşımaz — bu yüzden state'i userId + code_verifier'ı taşıyan
  // tek kullanımlık bir anahtar olarak Redis'te saklıyoruz.
  await redis.set(`canva:oauth:${state}`, JSON.stringify({ userId, codeVerifier }), 'EX', OAUTH_STATE_TTL_SEC);
  res.json({ url: getAuthorizeUrl(state, codeChallenge), state });
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Geçersiz istek');
    const raw = await redis.get(`canva:oauth:${state}`);
    if (!raw) return res.status(400).send('Oturum süresi doldu, panelden tekrar dene');
    await redis.del(`canva:oauth:${state}`);
    const { userId, codeVerifier } = JSON.parse(raw);
    await exchangeCodeForToken(code as string, userId, codeVerifier);
    res.redirect(`${env.APP_URL}/dashboard/canva?connected=1`);
  } catch (e: any) {
    res.status(500).send(`Canva bağlantı hatası: ${e.message}`);
  }
});

router.get('/status', async (req, res) => {
  const userId = req.userId!;
  const cfg = await prisma.canvaConfig.findUnique({ where: { userId } });
  res.json({ connected: !!cfg, expiresAt: cfg?.expiresAt, defaultTemplateId: cfg?.defaultTemplateId || null });
});

router.put('/default-template', async (req, res) => {
  const userId = req.userId!;
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
    const userId = req.userId!;
    const templates = await listTemplates(userId);
    res.json(templates);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/fill', async (req, res) => {
  try {
    const userId = req.userId!;
    const result = await fillCanvaTemplate(userId, req.body, req.body.templateId);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
