import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './env';

// Geliştirme/mock/test'te JWT_SECRET boş bırakılabilir — süreç ömrü boyunca
// sabit kalan rastgele bir anahtar üretilir (üretimde env.ts zaten zorunlu kılıyor).
const secret = env.JWT_SECRET || randomBytes(32).toString('hex');

const TOKEN_TTL = '30d';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, secret);
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Geçersiz token payload');
  }
  return payload.sub;
}
