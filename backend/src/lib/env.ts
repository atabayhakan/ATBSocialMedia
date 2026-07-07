import 'dotenv/config';
import { z } from 'zod';
import { isMockMode } from './mode';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'mock']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgresql://mock:mock@localhost:5432/mock'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GEMINI_API_KEY: z.string().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(8).default('change-me-in-production'),
  WA_QR_ENABLED: z.string().optional(),
  WA_BUSINESS_ENABLED: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Geçersiz ortam değişkenleri:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (isMockMode && !parsed.data.GEMINI_API_KEY) {
  console.log('ℹ️  MOCK mod: GEMINI_API_KEY boş, sahte yanıtlar kullanılacak.');
}

export const env = parsed.data;
