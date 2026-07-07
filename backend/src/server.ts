import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './lib/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

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

import { startScheduler } from './services/scheduler';
import { initWhatsApp } from './services/whatsapp';

const app = express();

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

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sources', sourcesRoutes);
app.use('/api/personas', personasRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/canva', canvaRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/mcp', mcpRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express hata middleware'ini 4 parametreden tanır, _next kaldırılamaz
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
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

    app.listen(env.PORT, () => {
      logger.info(`🚀 Backend ${env.PORT} portunda çalışıyor (${env.NODE_ENV})`);
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
