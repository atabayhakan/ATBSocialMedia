import cron from 'node-cron';
import { logger } from '../lib/logger';
import { fetchAllSources } from './newsFetcher';
import { processPendingPosts, sweepStuckTargets } from './publisher';
import { generateSlotsForAllUsers } from './planner';
import { prisma } from '../lib/prisma';

export function startScheduler() {
  // Açılışta bir kez: önceki çalıştırmadan askıda kalanları temizle
  sweepStuckTargets().catch((e) => logger.error({ e }, 'Açılış süpürücü hatası'));

  cron.schedule('*/10 * * * *', async () => {
    try {
      await sweepStuckTargets();
    } catch (e) {
      logger.error({ e }, 'Süpürücü hatası');
    }
  });

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

  // Pazartesi 03:00: cadence kurallarından önümüzdeki 2 haftalık takvim slotlarını üret.
  cron.schedule('0 3 * * 1', async () => {
    try {
      const created = await generateSlotsForAllUsers();
      logger.info({ created }, '⏰ Zamanlayıcı: cadence slotları üretildi');
    } catch (e) {
      logger.error({ e }, 'Zamanlayıcı slot üretim hatası');
    }
  });

  logger.info('⏰ Scheduler başlatıldı');
}
