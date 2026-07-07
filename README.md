# ATBSocialMedia

> **Tam otonom, AI destekli sosyal medya ve WhatsApp yönetim platformu.**
> RSS kaynaklarından haber çeker, Gemini ile içerik üretir, Canva şablonlarına yerleştirir ve tüm kanallarına sen uyurken paylaşır.

![Status](https://img.shields.io/badge/status-MVP-blueviolet) ![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20Nest--style%20Node-06b6d4) ![AI](https://img.shields.io/badge/AI-Gemini%201.5-4285F4)

---

## Mimari

```
ATBSocialMedia/
├── backend/                # Node.js + TypeScript API
│   ├── src/
│   │   ├── server.ts       # Express bootstrap
│   │   ├── lib/            # prisma, redis, logger, env
│   │   ├── routes/         # REST endpoints
│   │   └── services/       # gemini, whatsapp, newsFetcher, scheduler, publisher, canva, notifier
│   └── prisma/schema.prisma
├── frontend/               # Next.js 14 + Tailwind + shadcn/ui
│   └── src/
│       ├── app/            # App router (landing + dashboard)
│       ├── components/     # Sidebar, Topbar, UI primitives
│       └── lib/            # api client, utils
└── docs/                   # Ek dokümantasyon
```

## Modüller

| Modül                       | Teknoloji                              | Durum |
| --------------------------- | -------------------------------------- | ----- |
| Yönetim Paneli              | Next.js 14, Tailwind, shadcn/ui        | ✅    |
| AI İçerik Üretim            | OpenAI-uyumlu LLM (Groq varsayılan)    | ✅    |
| Haber Kaynak Tarayıcı       | rss-parser, cheerio                    | ✅    |
| Çeviri Motoru               | Gemini (çok dilli)                     | ✅    |
| Canva Entegrasyonu          | Canva Connect API (Autofill)           | ✅    |
| WhatsApp Yöntem A (QR)      | @whiskeysockets/baileys                | ✅    |
| WhatsApp Yöntem B (Resmi)   | Meta WhatsApp Business Cloud API       | ✅    |
| Çoklu Platform Yayını       | Twitter, LinkedIn, Instagram, FB, TT   | ✅    |
| Zamanlayıcı (Cron)          | node-cron                              | ✅    |
| Otonom Mesajlaşma           | Gemini + kritik bildirim (Telegram/Mail) | ✅  |
| Onay Destekli Mod           | (default)                              | ✅    |
| Tam Otonom Mod              | (settings'den seçilebilir)             | ✅    |

## Hızlı Başlangıç

### 1. Gereksinimler

- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- OpenAI-uyumlu bir LLM API anahtarı (ücretsiz: Groq — console.groq.com)
- (Opsiyonel) Canva Developer hesabı
- (Opsiyonel) Her platform için OAuth token

### 2. Kurulum

```powershell
# Bağımlılıklar
npm install

# Env dosyaları (kök .env.example sadece referanstır, okunmaz)
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local

# backend\.env dosyasını kendi anahtarlarınla düzenle
# (özellikle AI_API_KEY, DATABASE_URL zorunlu)

# Postgres + Redis (Docker kuruluysa):
docker compose up -d

# Veritabanı
npm run db:generate
npm run db:push

# Geliştirme
npm run dev
```

Frontend: `http://localhost:3000`
Backend:  `http://localhost:4000` — Health: `http://localhost:4000/health`

### 3. WhatsApp Bağlantısı

**Yöntem A (QR — ücretsiz):**
1. `backend/.env` içinde `WA_QR_ENABLED=true`
2. Backend'i başlat
3. Panel → WhatsApp → QR'ı telefonunla okut
4. Gelen mesajlar otomatik yanıtlanır

**Yöntem B (Resmi Business API):**
1. Meta Developer portal → WhatsApp App oluştur
2. `WA_BUSINESS_ENABLED=true` + `WA_PHONE_NUMBER_ID` + `WA_ACCESS_TOKEN` ekle
3. Webhook URL'ni ayarla: `https://<domain>/api/whatsapp/webhook`

### 4. Sosyal Medya Token'ları

Panel → Sosyal Hesaplar → "Hesap Ekle" → Platform + Access Token gir.

### 5. Canva

Panel → Canva Tasarım → "Canva ile Bağlan" → OAuth akışı.

## Komutlar

| Komut                  | Açıklama                          |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Hem backend hem frontend başlatır |
| `npm run dev:backend`  | Sadece backend (port 4000)        |
| `npm run dev:frontend` | Sadece frontend (port 3000)       |
| `npm run build`        | Üretim derlemesi                  |
| `npm run db:studio`    | Prisma Studio (veritabanı GUI)    |
| `npm run db:push`      | Şemayı veritabanına iter         |

## API Endpoints (özet)

- `GET  /health` — sağlık kontrolü
- `GET  /api/dashboard/stats` — panel istatistikleri
- `GET  /api/sources` — haber kaynakları
- `POST /api/sources` — yeni kaynak
- `POST /api/sources/:id/refresh` — kaynağı şimdi tara
- `GET  /api/personas` — AI kişilikleri
- `POST /api/personas` — yeni persona
- `GET  /api/posts?status=PENDING_APPROVAL` — taslaklar
- `POST /api/posts/generate` — şimdi içerik üret
- `POST /api/posts/:id/approve` — onayla
- `POST /api/posts/:id/reject` — reddet
- `POST /api/posts/:id/publish` — şimdi yayınla
- `GET  /api/whatsapp/status` — bağlantı durumu
- `GET  /api/whatsapp/qr` — QR data URL
- `GET  /api/whatsapp/qr/stream` — SSE ile canlı QR
- `POST /api/whatsapp/send` — manuel mesaj gönder
- `GET  /api/canva/templates` — şablonlar
- `POST /api/canva/fill` — AI ile metin yerleştir
- `GET  /api/social/accounts` — bağlı sosyal hesaplar
- `POST /api/social/accounts` — hesap ekle

## Veritabanı Şeması (özet)

`User` → `Persona`, `Niche`, `NewsSource` → `NewsItem`, `Post` → `PostTarget` (her platform için), `SocialAccount`, `WhatsAppConfig` → `WhatsAppMessage` / `WhatsAppReply`, `CanvaConfig`.

Detay: `backend/prisma/schema.prisma`

## Zamanlayıcı

| Cron            | İş                                                     |
| --------------- | ------------------------------------------------------ |
| `*/5 * * * *`   | Tüm aktif haber kaynaklarını tara                      |
| `*/2 * * * *`   | Zamanı gelen onaylanmış gönderileri yayınla            |
| `0 */6 * * *`   | 30 günden eski, kullanılmış haberleri temizle          |

## Otonom Modlar

1. **Onay Destekli (varsayılan):** AI taslak hazırlar → panelde listelenir → onaylarsan yayınlanır.
2. **Tam Otonom:** AI yazar + görseli seçer + direkt yayınlar (Settings'den açılır).

## Güvenlik & Uyarılar

- **Yöntem A (QR)** WhatsApp'ın spam politikalarına aykırı kullanımda numaran yasaklanabilir. İnsan onaylı mesajlarda sorun yok; toplu gönderimde dikkatli ol.
- **Yöntem B (Business API)** Meta tarafından mesaj başına ücretlendirilir.
- `.env` dosyalarını asla commit'leme. `.gitignore` zaten koruyor.
- API anahtarlarını düzenli olarak rotate et.

## Yol Haritası (önerilen sonraki sprintler)

- [ ] Kullanıcı authentication (NextAuth + Prisma adapter)
- [ ] Canlı analitik dashboard (engagement metrikleri)
- [ ] A/B testi (caption varyasyonları)
- [ ] Görsel üretimi (Imagen / DALL-E entegrasyonu)
- [ ] Video pipeline (FFmpeg + TikTok dikey format)
- [ ] Çoklu kiracı (multi-tenant) destek
- [ ] Docker compose ile tek komut kurulum
- [ ] Webhook güvenliği (imza doğrulama)

## Lisans

MIT — © ATBSocialMedia
