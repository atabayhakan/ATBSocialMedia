import 'dotenv/config';
import { z } from 'zod';
import { isMockMode } from './mode';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'mock']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Dinlenecek arayüz. Üretimde varsayılan 127.0.0.1 (yalnız yerel reverse proxy
  // erişir); geliştirmede 0.0.0.0. Gerekirse açıkça override edilebilir.
  HOST: z.string().optional(),
  DATABASE_URL: z.string().default('postgresql://mock:mock@localhost:5432/mock'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().default('https://api.groq.com/openai/v1'),
  AI_MODEL: z.string().default('llama-3.3-70b-versatile'),
  // Virgülle ayrılmış yedek modeller (OpenRouter'a özgü otomatik failover)
  AI_FALLBACK_MODELS: z.string().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // Panelin (frontend) genel-erişimli temel URL'i — OAuth callback sonrası
  // tarayıcı yönlendirmesi için.
  APP_URL: z.string().default('http://localhost:3000'),
  // Backend'in genel-erişimli temel URL'i — /media altında üretilen görsellerin
  // dışa açılan (Instagram vb. çekebilsin) linkleri için. Üretimde Caddy aynı
  // domain'i path'e göre yönlendirdiğinden APP_URL ile aynıdır (boş bırakılabilir).
  // Yerel geliştirmede frontend/backend farklı portta olduğundan ayrı verilebilir.
  MEDIA_BASE_URL: z.string().default(''),
  // 64 hex karakter (32 bayt) — DB'deki token/anahtar şifrelemesi için
  ENCRYPTION_KEY: z.string().default(''),
  // MCP endpoint'i için panel şifresinden bağımsız erişim anahtarı.
  // Boşsa token kontrolü yapılmaz (yerel/mock geliştirme).
  MCP_TOKEN: z.string().default(''),
  // Kullanıcı oturum JWT'lerini imzalamak için. Boşsa geliştirmede rastgele
  // (süreç ömrü boyunca sabit) bir anahtar üretilir — üretimde zorunlu.
  JWT_SECRET: z.string().default(''),
  WA_QR_ENABLED: z.string().optional(),
  WA_BUSINESS_ENABLED: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Geçersiz ortam değişkenleri:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (isMockMode && !parsed.data.AI_API_KEY) {
  console.log('ℹ️  MOCK mod: AI_API_KEY boş, sahte yanıtlar kullanılacak.');
}

// Üretimde güvenlik-kritik sırlar zorunlu: eksik/hatalıysa açılışta reddet.
// (Geliştirme/mock/test'te sessiz varsayılanlar kabul edilir.)
if (parsed.data.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (!parsed.data.ENCRYPTION_KEY) {
    problems.push('ENCRYPTION_KEY tanımsız — DB sırları düz metin saklanır');
  } else if (Buffer.from(parsed.data.ENCRYPTION_KEY, 'hex').length !== 32) {
    problems.push('ENCRYPTION_KEY 32 bayt (64 hex karakter) olmalı');
  }
  if (!parsed.data.MCP_TOKEN) {
    problems.push('MCP_TOKEN tanımsız — MCP endpoint kimlik doğrulamasız açık kalır');
  }
  if (!parsed.data.JWT_SECRET) {
    problems.push('JWT_SECRET tanımsız — kullanıcı oturumları imzalanamaz');
  }
  if (problems.length) {
    console.error(
      '❌ Üretimde güvenlik gereksinimleri karşılanmadı:\n  - ' + problems.join('\n  - ')
    );
    process.exit(1);
  }
}

export const env = parsed.data;

// Medya (/media) linkleri için kullanılacak taban URL — bkz. MEDIA_BASE_URL yorumu.
export const mediaBaseUrl = env.MEDIA_BASE_URL || env.APP_URL;
