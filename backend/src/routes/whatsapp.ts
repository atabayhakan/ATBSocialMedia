import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { waEvents, getCurrentQr, isWhatsAppConnected, sendWhatsAppMessage, sendWhatsAppBusinessApi } from '../services/whatsapp';

const router = Router();

router.get('/status', async (req, res) => {
  const userId = req.header('x-user-id');
  const cfg = await prisma.whatsAppConfig.findFirst({
    where: userId ? { userId } : undefined,
  });
  res.json({
    isConnected: isWhatsAppConnected(),
    qrAvailable: !!getCurrentQr(),
    config: cfg,
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
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'userId gerekli' });
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const cfg = await prisma.whatsAppConfig.upsert({
    where: { userId },
    create: { userId, mode: parsed.data.mode, phoneNumber: parsed.data.phoneNumber, meta: { phoneNumberId: parsed.data.phoneNumberId, accessToken: parsed.data.accessToken } },
    update: { mode: parsed.data.mode, phoneNumber: parsed.data.phoneNumber, meta: { phoneNumberId: parsed.data.phoneNumberId, accessToken: parsed.data.accessToken } },
  });
  res.json(cfg);
});

router.post('/send', async (req, res) => {
  try {
    const { to, text, mode } = req.body;
    if (mode === 'BUSINESS_API') {
      const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
      await sendWhatsAppBusinessApi(phoneNumberId!, to, text);
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
  const cfg = await prisma.whatsAppConfig.findFirst();
  if (!cfg) return res.json([]);
  const messages = await prisma.whatsAppMessage.findMany({
    where: { configId: cfg.id },
    orderBy: { receivedAt: 'desc' },
    take: 100,
  });
  res.json(messages);
});

export default router;
