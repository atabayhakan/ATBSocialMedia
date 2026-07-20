import axios from 'axios';
import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

export interface CriticalNotification {
  title: string;
  body: string;
}

// En az bir kanal mesajı gerçekten teslim ettiyse true döner. Çağıran (whatsapp
// servisi) yalnız bu durumda notifiedAt damgalar — hiçbir kanal ulaşmadıysa kayıt
// "bildirildi" görünmez (sahte teslim önlenir).
export async function notifyCritical(msg: CriticalNotification): Promise<boolean> {
  const results = await Promise.allSettled([sendTelegram(msg), sendEmail(msg)]);
  return results.some((r) => r.status === 'fulfilled' && r.value === true);
}

async function sendTelegram(msg: CriticalNotification): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text: `🚨 ${msg.title}\n\n${msg.body}`, parse_mode: 'HTML' },
      { timeout: 15_000 }
    );
    return true;
  } catch (e: any) {
    logger.error({ e }, 'Telegram bildirim hatası');
    return false;
  }
}

async function sendEmail(msg: CriticalNotification): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || user,
      to: process.env.MAIL_FROM || user,
      subject: `🚨 ${msg.title}`,
      text: msg.body,
    });
    return true;
  } catch (e: any) {
    logger.error({ e }, 'E-posta bildirim hatası');
    return false;
  }
}
