import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { env } from './lib/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { requireAuth } from './middleware/auth';

import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import sourcesRoutes from './routes/sources';
import personasRoutes from './routes/personas';
import postsRoutes from './routes/posts';
import whatsappRoutes from './routes/whatsapp';
import canvaRoutes from './routes/canva';
import socialRoutes from './routes/social';
import newsRoutes from './routes/news';
import settingsRoutes from './routes/settings';
import assistantRoutes from './routes/assistant';
import searchRoutes from './routes/search';
import mcpRoutes from './routes/mcp';
import imageTemplatesRoutes from './routes/imageTemplates';

import { startScheduler } from './services/scheduler';
import { initWhatsApp } from './services/whatsapp';

const app = express();

// Tek reverse proxy (Caddy) arkasındayız: X-Forwarded-For'a güven ki rate-limit
// gerçek istemci IP'sine göre çalışsın (aksi halde herkes proxy'nin 127.0.0.1'i
// olarak görünüp global paylaşımlı limite düşer).
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisOk = await redis.ping();
    res.json({
      status: 'ok',
      env: env.NODE_ENV,
      db: 'up',
      redis: redisOk === 'PONG' ? 'up' : 'down',
      time: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// /api/auth: oturum açma/kurulum, kimlik doğrulamasız erişilebilir.
// /api/mcp: kendi ayrı Bearer token'ıyla doğrular (bkz. routes/mcp.ts) — panel oturumundan bağımsız.
app.use('/api/auth', authRoutes);
app.use('/api/mcp', mcpRoutes);

// Geri kalan tüm /api/* rotaları panel oturumu (Authorization: Bearer <jwt>) gerektirir.
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/sources', requireAuth, sourcesRoutes);
app.use('/api/personas', requireAuth, personasRoutes);
app.use('/api/posts', requireAuth, postsRoutes);
app.use('/api/whatsapp', requireAuth, whatsappRoutes);
// Canva OAuth callback'i (Canva'nın tarayıcıyı yönlendirdiği istek) panel oturum
// token'ı taşımaz; sahiplik zaten state→Redis→userId ile sağlanır. Bu yüzden yalnız
// /callback requireAuth'tan muaf, diğer tüm /api/canva rotaları korumalı.
app.use(
  '/api/canva',
  (req, res, next) => (req.path === '/callback' ? next() : requireAuth(req, res, next)),
  canvaRoutes
);
app.use('/api/social', requireAuth, socialRoutes);
app.use('/api/news', requireAuth, newsRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/assistant', requireAuth, assistantRoutes);
app.use('/api/search', requireAuth, searchRoutes);
app.use('/api/image-templates', requireAuth, imageTemplatesRoutes);

// Üretilen/yüklenen görseller — Instagram/Facebook/TikTok gibi dış servislerin
// paylaşım sırasında görseli çekebilmesi için kimlik doğrulamasız (genel-erişimli).
// Caddy'de de bu yol basic auth'tan muaf tutulur. helmet'in varsayılan
// same-origin CORP'u bilinçli olarak gevşetiyoruz — içerik zaten genel-erişimli.
app.use('/media', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/media', express.static(path.join(__dirname, '../uploads')));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express hata middleware'ini 4 parametreden tanır, _next kaldırılamaz
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  const status = err.status || 500;
  // Üretimde 5xx'lerde iç hata detayını gizle (bilgi sızıntısı); 4xx mesajları
  // (doğrulama vb.) kullanıcıya yararlı olduğu için korunur.
  const expose = status < 500 || env.NODE_ENV !== 'production';
  res.status(status).json({ error: (expose && err.message) || 'Internal server error' });
});

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL bağlantısı başarılı');
    await redis.ping();
    logger.info('✅ Redis bağlantısı başarılı');

    if (env.WA_QR_ENABLED === 'true') {
      await initWhatsApp().catch((e) =>
        logger.warn({ e }, 'WhatsApp Baileys başlatılamadı, tekrar denenecek')
      );
    }

    startScheduler();

    // Üretimde yalnız loopback'e bağlan: dış trafik reverse proxy (Caddy) üzerinden
    // gelmek zorunda kalır, backend portu doğrudan internete açılamaz (ufw + savunma derinliği).
    const host = env.HOST || (env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
    app.listen(env.PORT, host, () => {
      logger.info(`🚀 Backend ${host}:${env.PORT} portunda çalışıyor (${env.NODE_ENV})`);
    });
  } catch (e) {
    logger.error({ e }, 'Bootstrap hatası');
    process.exit(1);
  }
}

// Testlerde app import edilir ama sunucu başlatılmaz
export { app };

if (require.main === module) {
  bootstrap();

  process.on('SIGINT', async () => {
    logger.info('Kapatılıyor...');
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
}
