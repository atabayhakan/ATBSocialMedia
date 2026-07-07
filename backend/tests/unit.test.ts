import { describe, it, expect } from 'vitest';
import { trimForTwitter, tweetWeightedLength } from '../src/services/publisher';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';
import { searchAll, PAGE_INDEX } from '../src/services/search';

describe('tweetWeightedLength', () => {
  it('normal metni karakter sayısıyla ölçer', () => {
    expect(tweetWeightedLength('merhaba')).toBe(7);
  });

  it('linkleri 23 karakter sayar', () => {
    const url = 'https://example.com/cok/uzun/bir/yol/daha/da/uzun/olsun/diye/devam';
    expect(tweetWeightedLength(url)).toBe(23);
    expect(tweetWeightedLength(`önce ${url} sonra`)).toBe(5 + 23 + 6);
  });
});

describe('trimForTwitter', () => {
  it('kısa içeriği olduğu gibi bırakır', () => {
    const out = trimForTwitter('Başlık', 'Gövde', ['#a', '#b']);
    expect(out).toBe('Başlık\n\nGövde\n\n#a #b');
  });

  it('uzun içeriği kırpar ama hashtag\'leri asla kesmez', () => {
    const out = trimForTwitter('B'.repeat(200), 'G'.repeat(200), ['#korunan', '#etiket']);
    expect(tweetWeightedLength(out)).toBeLessThanOrEqual(280);
    expect(out.endsWith('#korunan #etiket')).toBe(true);
    expect(out).toContain('...');
  });

  it('hashtag yoksa sonek eklemez', () => {
    const out = trimForTwitter('Başlık', 'Gövde', []);
    expect(out).toBe('Başlık\n\nGövde');
  });
});

describe('crypto (AES-256-GCM at-rest)', () => {
  it('şifreler ve geri çözer', () => {
    const secret = 'gsk_cok-gizli-token-degeri_123';
    const stored = encryptSecret(secret)!;
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
  });

  it('aynı değeri iki kez şifrelemek farklı çıktı verir (rastgele IV)', () => {
    expect(encryptSecret('abc')).not.toBe(encryptSecret('abc'));
  });

  it('legacy düz metni olduğu gibi döndürür', () => {
    expect(decryptSecret('duz-metin-eski-token')).toBe('duz-metin-eski-token');
  });

  it('null/boş değerleri bozmaz', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
    expect(encryptSecret('')).toBe('');
  });
});

describe('searchAll (sayfa dizini)', () => {
  it('türkçe anahtar kelimeyle sayfa bulur', async () => {
    const results = await searchAll('demo-user', 'şablon');
    expect(results.some((r) => r.href === '/dashboard/canva')).toBe(true);
  });

  it('2 karakterden kısa sorguda boş döner', async () => {
    expect(await searchAll('demo-user', 'a')).toEqual([]);
  });

  it('tüm sayfa href\'leri /dashboard ile başlar', () => {
    for (const p of PAGE_INDEX) expect(p.href.startsWith('/dashboard')).toBe(true);
  });
});
