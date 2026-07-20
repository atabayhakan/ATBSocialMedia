import Parser from 'rss-parser';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { translate } from './ai';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'ATBSocialMedia/0.1 (+https://atbsocialmedia.local)' },
});

export interface FetchResult {
  sourceId: string;
  newCount: number;
  total: number;
}

export async function fetchAllSources(): Promise<FetchResult[]> {
  const sources = await prisma.newsSource.findMany({
    where: { active: true },
    include: { user: { include: { niches: true } } },
  });

  const results: FetchResult[] = [];
  for (const source of sources) {
    try {
      const res = await fetchSingleSource(source.id);
      results.push(res);
    } catch (e: any) {
      logger.error({ e, sourceId: source.id, url: source.url }, 'Kaynak çekilemedi');
    }
  }
  return results;
}

export async function fetchSingleSource(sourceId: string): Promise<FetchResult> {
  const source = await prisma.newsSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error('Kaynak bulunamadı');

  let items: Array<{
    title: string;
    contentSnippet?: string;
    content?: string;
    link: string;
    isoDate?: string;
    pubDate?: string;
    enclosure?: { url?: string };
  }> = [];

  if (source.type === 'RSS') {
    const feed = await parser.parseURL(source.url);
    items = feed.items as any;
  } else if (source.type === 'WEB_SCRAPE') {
    const { data } = await axios.get(source.url, { timeout: 15000 });
    const cheerio = await import('cheerio');
    const $ = cheerio.load(data);
    // .post/.entry tam class eşleşmesi ister; çoğu site "post_wrapper", "news-card" gibi
    // alt-string varyantları kullanır — [class*=] ile bunları da yakala.
    const CARD_SELECTOR =
      'article, .post, .entry, [class*="post"], [class*="entry"], [class*="article"]';
    const seenLinks = new Set<string>();
    $(CARD_SELECTOR).each((_: number, el: any) => {
      const $el = $(el);
      if ($el.find(CARD_SELECTOR).length > 0) return; // dış sarmalayıcıyı atla, sadece en içteki kartı al
      const title = $el.find('h1, h2, h3').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      if (!title || !href) return;
      const link = new URL(href, source.url).toString();
      if (seenLinks.has(link)) return;
      seenLinks.add(link);
      items.push({
        title,
        link,
        contentSnippet: $el.find('p').first().text().trim().slice(0, 400),
      });
    });
  }

  let newCount = 0;
  for (const item of items) {
    if (!item.link) continue; // url alanı zorunlu/unique; link'siz öğe eklenemez

    // Tek bir öğenin hatası (mükerrer url/P2002 yarışı, çeviri, geçersiz veri) tüm
    // turu kesmemeli — böylece kalan öğeler ve lastFetchedAt güncellemesi atlanmaz.
    try {
      const externalId = item.link;
      const exists = await prisma.newsItem.findUnique({ where: { url: item.link } });
      if (exists) continue;

      let title = item.title;
      let summary = item.contentSnippet || '';
      const imageUrl = item.enclosure?.url;

      const sourceUser = await prisma.user.findUnique({ where: { id: source.userId } });
      const userNicheLang = source.targetLanguage || sourceUser?.publishLanguage || source.language;

      if (source.language !== userNicheLang) {
        try {
          title = await translate(item.title, userNicheLang);
          if (summary) summary = await translate(summary, userNicheLang);
        } catch {
          /* çeviri başarısızsa orijinali kullan */
        }
      }

      await prisma.newsItem.create({
        data: {
          sourceId: source.id,
          externalId,
          title,
          summary,
          content: item.content || null,
          url: item.link,
          imageUrl,
          language: userNicheLang,
          publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
        },
      });
      newCount++;
    } catch (e: any) {
      // Eşzamanlı tarama aynı url'i araya sokmuş olabilir (P2002) — sessizce atla.
      if (e?.code !== 'P2002') {
        logger.warn({ e, url: item.link, sourceId: source.id }, 'Haber öğesi kaydedilemedi, atlanıyor');
      }
    }
  }

  await prisma.newsSource.update({
    where: { id: source.id },
    data: { lastFetchedAt: new Date() },
  });

  logger.info({ sourceId, newCount, total: items.length }, 'Kaynak tarandı');
  return { sourceId, newCount, total: items.length };
}

export async function pickNextNewsItemForUser(userId: string) {
  const niche = await prisma.niche.findFirst({ where: { userId, active: true } });
  if (!niche) return null;

  // Manuel nested filter (mock store uyumluluğu için)
  const sources = await prisma.newsSource.findMany({
    where: { active: true, nicheId: niche.id },
  });
  const sourceIds = sources.map((s: any) => s.id);
  if (sourceIds.length === 0) return null;

  // Yalnız bu kullanıcının kaynaklarındaki kullanılmamış haberler (belleğe tüm
  // tabloyu değil, ilgili kaynakları çeker).
  const items = await prisma.newsItem.findMany({
    where: { used: false, sourceId: { in: sourceIds } },
    orderBy: { publishedAt: 'desc' },
  });

  // ATOMİK sahiplen: haberi burada used=true yap. updateMany yalnız hâlâ used=false
  // ise (count===1) sahiplenir; eşzamanlı başka bir üretim aynı haberi kaptıysa
  // count 0 döner ve sıradaki habere geçilir — aynı haberden mükerrer gönderiyi önler.
  for (const item of items) {
    const claim = await prisma.newsItem.updateMany({
      where: { id: item.id, used: false },
      data: { used: true },
    });
    if (claim.count === 1) return { ...item, used: true };
  }
  return null;
}
