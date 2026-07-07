import cron from 'node-cron';
import { logger } from '../lib/logger';
import { fetchAllSources } from './newsFetcher';
import { processPendingPosts } from './publisher';
import { prisma } from '../lib/prisma';

export function startScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('⏰ Zamanlayıcı: haber kaynakları taranıyor');
      await fetchAllSources();
    } catch (e) {
      logger.error({ e }, 'Zamanlayıcı haber çekme hatası');
    }
  });

  cron.schedule('*/2 * * * *', async () => {
    try {
      logger.info('⏰ Zamanlayıcı: zamanı gelen gönderiler yayınlanıyor');
      await processPendingPosts();
    } catch (e) {
      logger.error({ e }, 'Zamanlayıcı yayınlama hatası');
    }
  });

  cron.schedule('0 */6 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count } = await prisma.newsItem.deleteMany({
        where: { fetchedAt: { lt: cutoff }, used: true },
      });
      logger.info({ count }, 'Eski kullanılmış haberler temizlendi');
    } catch (e) {
      logger.error({ e }, 'Temizlik hatası');
    }
  });

  logger.info('⏰ Scheduler başlatıldı');
}
