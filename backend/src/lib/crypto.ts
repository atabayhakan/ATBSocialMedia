// Veritabanında duran sırlar (sosyal medya token'ları, API anahtarları) için
// at-rest şifreleme. AES-256-GCM; anahtar backend/.env → ENCRYPTION_KEY (64 hex karakter).
//
// Format: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
// decryptSecret, "enc:v1:" öneki taşımayan değerleri olduğu gibi döndürür —
// böylece şifreleme öncesi kaydedilmiş (legacy) değerler kırılmadan çalışmaya
// devam eder ve bir sonraki kayıtta şifrelenir.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from './env';
import { logger } from './logger';

const PREFIX = 'enc:v1:';

let warned = false;

function getKey(): Buffer | null {
  if (!env.ENCRYPTION_KEY) {
    if (!warned) {
      logger.warn('ENCRYPTION_KEY tanımsız — sırlar düz metin saklanacak (üretimde önerilmez)');
      warned = true;
    }
    return null;
  }
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY 32 bayt (64 hex karakter) olmalı');
  return key;
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return plain ?? null;
  const key = getKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return stored ?? null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy düz metin
  const key = getKey();
  if (!key) throw new Error('Şifreli değer var ama ENCRYPTION_KEY tanımsız');
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
