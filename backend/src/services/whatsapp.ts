import { EventEmitter } from 'events';
import QRCode from 'qrcode';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateWhatsAppReply } from './ai';
import { notifyCritical } from './notifier';

type BaileysSocket = any;

export const waEvents = new EventEmitter();

let currentSocket: BaileysSocket | null = null;
let lastQr: string | null = null;

export async function initWhatsApp() {
  if (process.env.WA_QR_ENABLED !== 'true') return;
  try {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = await import(
      '@whiskeysockets/baileys'
    );
    const { state, saveCreds } = await useMultiFileAuthState(process.env.WA_SESSION_PATH || './.wa-sessions');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });
    currentSocket = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        lastQr = await QRCode.toDataURL(qr);
        waEvents.emit('qr', lastQr);
        logger.info('📱 WhatsApp QR kodu oluşturuldu');
      }
      if (connection === 'open') {
        lastQr = null;
        waEvents.emit('connected', true);
        logger.info('✅ WhatsApp bağlantısı kuruldu');
        const cfg = await prisma.whatsAppConfig.findFirst({ where: { mode: 'QR_BAILEYS' } });
        if (cfg) {
          await prisma.whatsAppConfig.update({
            where: { id: cfg.id },
            data: { isConnected: true, lastConnectedAt: new Date(), phoneNumber: sock.user?.id?.split(':')[0] },
          });
        }
      }
      if (connection === 'close') {
        waEvents.emit('disconnected', true);
        const reason = (lastDisconnect?.error as any)?.output?.statusCode;
        if (reason !== DisconnectReason.loggedOut) {
          setTimeout(() => initWhatsApp().catch((e) => logger.error({ e }, 'WA reconnect hatası')), 5000);
        } else {
          logger.warn('WhatsApp oturumu kapatıldı (logged out)');
        }
      }
    });

    sock.ev.on('messages.upsert', async (m: any) => {
      if (m.type !== 'notify') return;
      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;
        await handleIncomingMessage(sock, msg);
      }
    });
  } catch (e: any) {
    logger.error({ e }, 'WhatsApp başlatılamadı');
  }
}

export function getCurrentQr(): string | null {
  return lastQr;
}

export function isWhatsAppConnected(): boolean {
  return currentSocket != null;
}

export async function sendWhatsAppMessage(remoteJid: string, text: string) {
  if (!currentSocket) throw new Error('WhatsApp bağlı değil');
  await currentSocket.sendMessage(remoteJid, { text });
}

export async function sendWhatsAppBusinessApi(phoneNumberId: string, to: string, text: string) {
  const token = process.env.WA_ACCESS_TOKEN;
  if (!token) throw new Error('WA_ACCESS_TOKEN tanımsız');
  await axios.post(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

async function handleIncomingMessage(sock: BaileysSocket, msg: any) {
  const remoteJid = msg.key.remoteJid;
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    '';

  if (!body) return;

  const cfg = await prisma.whatsAppConfig.findFirst({ where: { mode: 'QR_BAILEYS' } });
  if (!cfg) return;

  await prisma.whatsAppMessage.create({
    data: { configId: cfg.id, remoteJid, fromMe: false, body },
  });

  const persona = await prisma.persona.findFirst({
    where: { userId: cfg.userId, isDefault: true },
  });

  const personaConfig = persona
    ? {
        name: persona.name,
        tone: persona.tone,
        language: persona.language,
        voiceRules: persona.voiceRules,
        forbiddenTopics: persona.forbiddenTopics,
      }
    : {
        name: 'ATB Asistan',
        tone: 'Samimi, profesyonel, yardımsever',
        language: 'tr',
      };

  const { reply, isCritical } = await generateWhatsAppReply({
    incoming: body,
    persona: personaConfig,
  });

  const replyRecord = await prisma.whatsAppReply.create({
    data: {
      configId: cfg.id,
      personaId: persona?.id,
      remoteJid,
      incomingBody: body,
      replyBody: reply,
      isCritical,
    },
  });

  try {
    await sock.sendMessage(remoteJid, { text: reply });
    await prisma.whatsAppMessage.create({
      data: { configId: cfg.id, remoteJid, fromMe: true, body: reply, replyId: replyRecord.id },
    });
  } catch (e: any) {
    logger.error({ e }, 'Yanıt gönderilemedi');
  }

  if (isCritical) {
    await notifyCritical({
      title: 'Kritik WhatsApp mesajı',
      body: `${remoteJid}: ${body}\n\nAI yanıtı: ${reply}`,
    });
    await prisma.whatsAppReply.update({
      where: { id: replyRecord.id },
      data: { notifiedAt: new Date() },
    });
  }
}
