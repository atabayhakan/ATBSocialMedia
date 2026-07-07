import Parser from 'rss-parser';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { translate } from './gemini';

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
    $('article, .post, .entry').each((_: number, el: any) => {
      const title = $(el).find('h1, h2, h3').first().text().trim();
      const link = $(el).find('a').first().attr('href') || '';
      if (title && link) {
        items.push({
          title,
          link: new URL(link, source.url).toString(),
          contentSnippet: $(el).find('p').first().text().trim().slice(0, 400),
        });
      }
    });
  }

  let newCount = 0;
  for (const item of items) {
    if (!item.link) continue; // url alanı zorunlu/unique; link'siz öğe eklenemez

    const externalId = item.link;
    const exists = await prisma.newsItem.findUnique({ where: { url: item.link } });
    if (exists) continue;

    let title = item.title;
    let summary = item.contentSnippet || '';
    const imageUrl = item.enclosure?.url;

    const defaultPersona = await prisma.persona.findFirst({ where: { userId: source.userId, isDefault: true } });
    const userNicheLang = defaultPersona?.language || source.language;

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
  const sourceIds = new Set(sources.map((s: any) => s.id));
  if (sourceIds.size === 0) return null;

  const items = await prisma.newsItem.findMany({
    where: { used: false },
    orderBy: { publishedAt: 'desc' },
  });
  return items.find((i: any) => sourceIds.has(i.sourceId)) || null;
}
