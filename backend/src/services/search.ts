// Panel geneli arama: statik sayfa dizini + veritabanı içeriği.
// Hem üst bardaki arama kutusu (GET /api/search) hem de ATB Asistan
// ("X nerede?" sorularında yönlendirme için) bunu kullanır.
import { prisma } from '../lib/prisma';

export interface SearchResult {
  type: 'PAGE' | 'POST' | 'SOURCE' | 'PERSONA' | 'ACCOUNT';
  title: string;
  detail: string;
  href: string;
}

// Panel sayfaları ve onları bulduran Türkçe anahtar kelimeler
export const PAGE_INDEX: Array<{ href: string; title: string; keywords: string[] }> = [
  { href: '/dashboard', title: 'Genel Bakış', keywords: ['genel', 'bakis', 'bakış', 'dashboard', 'istatistik', 'kpi', 'ozet', 'özet', 'uret', 'üret'] },
  { href: '/dashboard/strategy', title: 'Marka Stratejisi', keywords: ['strateji', 'marka', 'pozisyon', 'ses', 'sutun', 'sütun', 'pillar', 'cadence', 'siklik', 'sıklık'] },
  { href: '/dashboard/trends', title: 'Trendler', keywords: ['trend', 'sinyal', 'skor', 'briefing', 'ozet', 'özet', 'fit matrix'] },
  { href: '/dashboard/calendar', title: 'İçerik Takvimi', keywords: ['takvim', 'icerik', 'içerik', 'onay', 'gonderi', 'gönderi', 'post', 'yayin', 'yayın', 'reddet', 'zamanla', 'taslak'] },
  { href: '/dashboard/sources', title: 'Haber Kaynakları', keywords: ['kaynak', 'rss', 'haber', 'feed', 'tara', 'scrape'] },
  { href: '/dashboard/personas', title: 'AI Kişilikler', keywords: ['persona', 'kisilik', 'kişilik', 'ton', 'ses', 'varsayilan', 'varsayılan'] },
  { href: '/dashboard/whatsapp', title: 'WhatsApp', keywords: ['whatsapp', 'qr', 'mesaj', 'baileys', 'business'] },
  { href: '/dashboard/canva', title: 'Canva Tasarım', keywords: ['canva', 'sablon', 'şablon', 'tasarim', 'tasarım', 'gorsel', 'görsel', 'autofill'] },
  { href: '/dashboard/social', title: 'Sosyal Hesaplar', keywords: ['sosyal', 'hesap', 'twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'token', 'platform'] },
  { href: '/dashboard/settings', title: 'Ayarlar', keywords: ['ayar', 'dil', 'yayin dili', 'yayın dili', 'otonom', 'mod', 'bildirim', 'tema', 'asistan', 'api', 'saglayici', 'sağlayıcı'] },
];

function norm(s: string): string {
  return s.toLocaleLowerCase('tr');
}

export async function searchAll(userId: string, query: string): Promise<SearchResult[]> {
  const q = norm(query.trim());
  if (q.length < 2) return [];

  const pageHits: SearchResult[] = PAGE_INDEX.filter(
    (p) => norm(p.title).includes(q) || p.keywords.some((k) => k.includes(q) || q.includes(k))
  ).map((p) => ({ type: 'PAGE', title: p.title, detail: 'Panel sayfası', href: p.href }));

  const [posts, sources, personas, accounts] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []),
    prisma.newsSource.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { url: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
    }).catch(() => []),
    prisma.persona.findMany({
      where: { userId, name: { contains: query, mode: 'insensitive' } },
      take: 3,
    }).catch(() => []),
    prisma.socialAccount.findMany({
      where: { userId, accountName: { contains: query, mode: 'insensitive' } },
      take: 3,
    }).catch(() => []),
  ]);

  return [
    ...pageHits,
    ...posts.map((p: any) => ({
      type: 'POST' as const,
      title: p.title,
      detail: `Gönderi · ${p.status}`,
      href: '/dashboard/calendar',
    })),
    ...sources.map((s: any) => ({
      type: 'SOURCE' as const,
      title: s.name,
      detail: `Haber kaynağı · ${s.type}`,
      href: '/dashboard/sources',
    })),
    ...personas.map((p: any) => ({
      type: 'PERSONA' as const,
      title: p.name,
      detail: 'AI kişilik',
      href: '/dashboard/personas',
    })),
    ...accounts.map((a: any) => ({
      type: 'ACCOUNT' as const,
      title: a.accountName,
      detail: `Sosyal hesap · ${a.platform}`,
      href: '/dashboard/social',
    })),
  ].slice(0, 12);
}
