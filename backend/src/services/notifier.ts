import axios from 'axios';
import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

export interface CriticalNotification {
  title: string;
  body: string;
}

export async function notifyCritical(msg: CriticalNotification) {
  await Promise.allSettled([sendTelegram(msg), sendEmail(msg)]);
}

async function sendTelegram(msg: CriticalNotification) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: `🚨 ${msg.title}\n\n${msg.body}`,
      parse_mode: 'HTML',
    });
  } catch (e: any) {
    logger.error({ e }, 'Telegram bildirim hatası');
  }
}

async function sendEmail(msg: CriticalNotification) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return;

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
  } catch (e: any) {
    logger.error({ e }, 'E-posta bildirim hatası');
  }
}
