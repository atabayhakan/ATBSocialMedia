import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { waEvents, getCurrentQr, isWhatsAppConnected, sendWhatsAppMessage, sendWhatsAppBusinessApi } from '../services/whatsapp';

const router = Router();

// meta içindeki Business API accessToken'ını yanıtta asla açığa çıkarma.
function redactConfig(cfg: any) {
  if (!cfg || !cfg.meta) return cfg;
  const meta = { ...(cfg.meta as any) };
  if (meta.accessToken) meta.accessToken = '***';
  return { ...cfg, meta };
}

router.get('/status', async (req, res) => {
  const cfg = await prisma.whatsAppConfig.findFirst({ where: { userId: req.userId } });
  res.json({
    isConnected: isWhatsAppConnected(),
    qrAvailable: !!getCurrentQr(),
    config: redactConfig(cfg),
  });
});

router.get('/qr', (_req, res) => {
  const qr = getCurrentQr();
  if (!qr) return res.status(404).json({ error: 'QR hazır değil' });
  res.json({ qr });
});

router.get('/qr/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onQr = (qr: string) => res.write(`data: ${JSON.stringify({ type: 'qr', qr })}\n\n`);
  const onConn = (connected: boolean) =>
    res.write(`data: ${JSON.stringify({ type: 'connected', connected })}\n\n`);

  waEvents.on('qr', onQr);
  waEvents.on('connected', onConn);
  waEvents.on('disconnected', onConn);

  req.on('close', () => {
    waEvents.off('qr', onQr);
    waEvents.off('connected', onConn);
    waEvents.off('disconnected', onConn);
  });
});

const configSchema = z.object({
  mode: z.enum(['QR_BAILEYS', 'BUSINESS_API']),
  phoneNumber: z.string().optional(),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  webhookUrl: z.string().optional(),
});

router.post('/config', async (req, res) => {
  const userId = req.userId!;
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Business API token'ı diğer platform token'ları gibi at-rest şifrele.
  const meta = {
    phoneNumberId: parsed.data.phoneNumberId,
    accessToken: parsed.data.accessToken ? encryptSecret(parsed.data.accessToken) : undefined,
  };
  const cfg = await prisma.whatsAppConfig.upsert({
    where: { userId },
    create: { userId, mode: parsed.data.mode, phoneNumber: parsed.data.phoneNumber, meta },
    update: { mode: parsed.data.mode, phoneNumber: parsed.data.phoneNumber, meta },
  });
  res.json(redactConfig(cfg));
});

const sendSchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1),
  mode: z.enum(['QR_BAILEYS', 'BUSINESS_API']).optional(),
});

router.post('/send', async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { to, text, mode } = parsed.data;
  try {
    if (mode === 'BUSINESS_API') {
      // Kullanıcının kendi Business yapılandırmasını (numara + token) kullan; yoksa
      // ortam değişkenine düş. Böylece gönderim çağıran kullanıcıya bağlanır.
      const cfg = await prisma.whatsAppConfig.findFirst({ where: { userId: req.userId } });
      const meta = (cfg?.meta as any) || {};
      const phoneNumberId = meta.phoneNumberId || process.env.WA_PHONE_NUMBER_ID;
      const token = meta.accessToken ? decryptSecret(meta.accessToken) : process.env.WA_ACCESS_TOKEN;
      if (!phoneNumberId || !token) {
        return res.status(400).json({ error: 'WhatsApp Business yapılandırması eksik (numara/token)' });
      }
      await sendWhatsAppBusinessApi(phoneNumberId, token, to, text);
    } else {
      const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
      await sendWhatsAppMessage(jid, text);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/messages', async (req, res) => {
  const cfg = await prisma.whatsAppConfig.findFirst({ where: { userId: req.userId } });
  if (!cfg) return res.json([]);
  const messages = await prisma.whatsAppMessage.findMany({
    where: { configId: cfg.id },
    orderBy: { receivedAt: 'desc' },
    take: 100,
  });
  res.json(messages);
});

export default router;
