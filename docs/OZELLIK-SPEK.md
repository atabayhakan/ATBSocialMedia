# ATBSocialMedia — Özellik Spesifikasyonu ve Nt Web Geçiş Planı

> **Versiyon:** 0.1.0 (Tasarım)
> **Tarih:** 2026-07-06
> **Kapsam:** Platformun tüm modüllerinin detaylı tanımı, ekranları, veri modelleri, iş akışları ve Nt Web Social Bot'tan aktarılacak/iyileştirilecek özellikler.

---

## 1. Vizyon ve Konumlandırma

ATBSocialMedia; tek başına **post üreten**, **paylaşan** ve **müşteri mesajlarını yanıtlayan** tam otonom bir sosyal medya asistanıdır. Nt Web Social Bot'un aksine:

- **API-first** (resmi platform API'leri) birincil yol; Playwright sadece fallback.
- **AI-first** (Gemini 1.5 Pro) içerik üretimi, çeviri, kişilik ve WhatsApp yanıtları.
- **Onay destekli** varsayılan mod (spam/hesap yasaklanma riskini en aza indirir).
- **Çoklu niş** (birden fazla konu/hesap aynı panelden yönetilebilir).
- **WhatsApp dahil** — sadece sosyal medya değil, doğrudan müşteri iletişimi.

---

## 2. Kullanıcı Rolleri ve İzinler

| Rol | Yetkiler |
|---|---|
| **OWNER** | Her şey: hesap oluşturma, ödeme, tam otonom mod açma |
| **ADMIN** | Tüm içerikler, kişilikler, kaynaklar, sosyal hesaplar, WhatsApp |
| **EDITOR** | İçerik oluşturma, taslak düzenleme, onay/reddetme yok |

---

## 3. Veri Modeli (Prisma Şeması — `backend/prisma/schema.prisma`)

### 3.1. Temel Varlıklar

```
User
├─ personas (1:N)
├─ niches (1:N)
├─ sources (1:N)
├─ posts (1:N)
├─ accounts (1:N — sosyal platform bağlantıları)
├─ whatsappConfig (1:1)
└─ canvaConfig (1:1)

Niche ─< NewsSource ─< NewsItem
                  └──────────────┐
                                 ▼
Persona ─────────────────► Post ─► PostTarget (her platform için 1 satır)
                                └─ canvaDesignId (opsiyonel)

WhatsAppConfig ─► WhatsAppMessage (gelen/giden)
              └─► WhatsAppReply (AI yanıtı + isCritical)
```

### 3.2. Post Durum Makinesi

```
DRAFT
  └─→ PENDING_APPROVAL   (AI üretti, onay bekliyor)
        ├─→ APPROVED → SCHEDULED → PUBLISHING → PUBLISHED
        ├─→ SCHEDULED (zamanlı) → PUBLISHING → PUBLISHED
        ├─→ REJECTED
        └─→ DRAFT (revize için geri)
  └─→ APPROVED (FULLY_AUTONOMOUS moddaysa direkt)
        └─→ PUBLISHING → PUBLISHED
FAILED → APPROVED (retry için geri)
```

### 3.3. Yayın Modları

- **`APPROVAL`** (varsayılan): AI taslak hazırlar → panelde listelenir → kullanıcı onaylar veya Telegram'dan tek tıkla onay → yayınlanır.
- **`FULLY_AUTONOMOUS`**: AI yazar + görseli seçer/üretir + direkt yayınlar. Kullanıcı sadece logları izler.

### 3.4. Yayın Kanalı (Per-Platform)

Her `PostTarget` satırı tek bir platformu temsil eder. Avantajı:
- Bir platformda hata olursa diğerleri etkilenmez
- "Sadece X'te tekrarla" Nt Web'in retry mantığıyla aynı
- Her platform için ayrı external ID saklanır (URL/permalink oluşturma için)

---

## 4. Modüller — Detaylı Spesifikasyon

### 4.1. Haber Kaynak Yönetimi (RSS / Web Scrape / API)

**Ekran:** `/dashboard/sources`

**Özellikler:**
- RSS, Web Scrape (cheerio), API olmak üzere 3 tipte kaynak eklenebilir
- Her kaynak bir `Niche`'ye atanabilir (örn: "Teknoloji", "Finans", "Otomobil")
- Otomatik tarama aralığı (dk cinsinden, min 5)
- "Şimdi Tara" butonu ile manuel tetikleme
- Kaynak dili: EN/TR/...
- Çekilen haberler `NewsItem` tablosuna eklenir, otomatik Gemini ile hedef dile çevrilir
- Kullanılmış haberler 30 gün sonra otomatik temizlenir (cron)

**Nt Web'den farkı:** Nt Web tek bir RSS feed'i desteklerken ATBSocialMedia **çoklu niş + çoklu feed + otomatik çeviri** yapar.

**API Endpoints:**
- `GET /api/sources` — listele
- `POST /api/sources` — ekle
- `POST /api/sources/:id/refresh` — şimdi tara
- `DELETE /api/sources/:id` — sil

### 4.2. AI Kişilik Yönetimi (Personas)

**Ekran:** `/dashboard/personas`

**Özellikler:**
- Persona = AI'ın konuşma/yazma stili
- Alanlar: isim, ton, dil, ses kuralları, yasaklı konular, varsayılan mı
- Birden fazla persona, **bir tanesi varsayılan** olabilir
- İçerik üretiminde ve WhatsApp yanıtlarında aynı persona kullanılır (veya persona başına override)

**Nt Web'den farkı:** Nt Web'de kişilik tanımı yok; her paylaşım aynı formatta çıkar. ATBSocialMedia **marka sesi** kavramını destekler.

**API Endpoints:**
- `GET /api/personas` — listele
- `POST /api/personas` — oluştur
- `PUT /api/personas/:id` — güncelle
- `DELETE /api/personas/:id` — sil

### 4.3. AI İçerik Üretim Motoru (Gemini 1.5 Pro)

**Servis:** `backend/src/services/gemini.ts`

**3 Temel Fonksiyon:**

1. **`generatePostFromNews(news, persona, targetLang)`**
   - Kaynak: RSS'ten gelen `NewsItem`
   - Çıktı: `{ title, body, hashtags, summary }` (strict JSON)
   - System prompt persona bilgilerini, dil ve ton kurallarını içerir
   - Temperature: 0.7
   - response_mime_type: application/json

2. **`translate(text, targetLang)`**
   - Birincil çeviri yolu olarak Gemini kullanılır
   - Alternatif: DeepL veya LibreTranslate (gelecekte)

3. **`generateWhatsAppReply(incoming, persona)`**
   - Gelen mesaj → persona'ya uygun yanıt
   - `isCritical` boolean: Ödeme, güvenlik, öfke, hukuk içerirse `true`
   - Kritik mesajlar Telegram + e-posta ile yöneticiye bildirilir

**Niche-Bağlamsal İçerik:**
- Birden fazla niş olduğunda, kullanıcının o anki "aktif nişi" hangi kaynaklardan çekileceğini belirler
- Bir nişten diğerine otomatik geçiş (zamanlama veya manuel)

### 4.4. İçerik Takvimi ve Onay Akışı

**Ekran:** `/dashboard/calendar`

**Özellikler:**
- Tabs: Onay Bekliyor / Onaylandı / Zamanlandı / Yayında / Reddedildi
- Her post için:
  - Başlık, gövde, hashtag'ler
  - Görsel önizleme
  - Hedef platform ikonları (FB, IG, X, LinkedIn, TikTok)
  - Butonlar: Onayla / Reddet / Şimdi Yayınla / Zamanla
- Zamanlama: tarih/saat seçici (gelecekte)
- Tek tıkla Telegram onayı (webhook → bot)

**Nt Web'den farkı:** Nt Web sadece otomatik paylaşır; ATBSocialMedia **güvenli onay mekanizması** sunar (özellikle AI üretiminde bu hayati).

### 4.5. Sosyal Medya Yayın Servisi (Publisher)

**Servis:** `backend/src/services/publisher.ts`

**Desteklenen Platformlar:**

| Platform | API | Playwright Fallback | Karakter Limiti | Medya Zorunlu mu |
|---|---|---|---|---|
| Twitter/X | v2 API | ❌ | 280 (link 23) | Hayır |
| LinkedIn | UGC API | ❌ | 3000 | Hayır (varsa daha iyi) |
| Instagram | Graph API | ✅ (gelecek) | 2200 | **Evet** (1+) |
| Facebook | Graph API (Page) | ❌ | 63206 | Hayır |
| TikTok | Content Posting API | ❌ | 2200 | **Evet** (video) |

**Karakter Kırpma (Twitter):**
- Nt Web gibi: link 23 karakter sayılır, toplam 280'i aşarsa başlık kırpılır + "..." eklenir
- Hashtag ve link asla kesilmez

**Yayın Akışı:**
```
Post.approve() → PostTarget oluştur (her hesap için)
   ↓
Cron (*/2 min) → processPendingPosts()
   ↓
Her hedef için publishToPlatform()
   ├─ status: PUBLISHING
   ├─ platform API çağrısı
   ├─ başarı: externalId kaydet, status: PUBLISHED
   └─ hata: status: FAILED + error log
   ↓
Tüm hedefler tamam → Post.status: PUBLISHED
```

**Retry Mekanizması (Nt Web'den alınan):**
- Tek bir platform başarısız olursa sadece o `PostTarget` retry edilir
- "Sadece X'te tekrarla" UI'da mümkün (her hedefin yanında ↺ butonu)

**Hata Yönetimi:**
- Hata anında ekran görüntüsü **sadece Playwright modunda** alınır (gelecekte)
- API modunda: HTTP yanıtı + hata mesajı loglanır
- Self-healing: bir sonraki cron tick'i kuyruktaki hatalı postu otomatik tekrar dener (max 3 deneme)

### 4.6. WhatsApp Entegrasyonu (Çift Mod)

**Ekran:** `/dashboard/whatsapp`

**Mod A — QR Kod (Baileys, ücretsiz):**
- `WA_QR_ENABLED=true` ile backend başlatıldığında otomatik QR üretilir
- QR ekranda gösterilir, panelden SSE ile canlı takip edilir
- `whatsapp-web.js` veya `@whiskeysockets/baileys` kullanılır
- Oturum `.wa-sessions/` klasöründe saklanır
- **Avantaj:** Ücretsiz, kendi numaranı kullanırsın
- **Risk:** WhatsApp'ın spam politikasına dikkat (toplu mesaj yasak, kişisel iletişim serbest)
- **Bağlantı koparsa:** otomatik reconnect (logged out değilse)

**Mod B — Resmi Business API (Meta Cloud):**
- Meta Developer portal → WhatsApp App oluştur
- Phone Number ID + Access Token → `backend/.env`
- Webhook URL: `https://<domain>/api/whatsapp/webhook`
- Mesaj başına Meta tarafından ücretlendirilir
- **Avantaj:** Spam riski yok, güvenli, ölçeklenebilir
- **Risk:** Aylık 1000 ücretsiz servisli konuşma, sonrası ücretli

**Gelen Mesaj Akışı (her iki mod için):**
```
incoming message
   ↓
handleIncomingMessage()
   ↓
load default persona
   ↓
Gemini.generateWhatsAppReply()
   ├─ reply.body
   └─ isCritical: boolean
   ↓
DB'ye kaydet (WhatsAppMessage + WhatsAppReply)
   ↓
reply gönder
   ↓
if isCritical:
   ├─ Telegram bildirimi (TELEGRAM_BOT_TOKEN + CHAT_ID)
   └─ E-posta bildirimi (SMTP)
```

**Kritik Mesaj Tespiti:**
- Ödeme, fatura, hesap güvenliği
- Hukuki tehdit, dava
- Acil şikayet, öfke ifadesi
- Manuel override: AI her zaman `isCritical: true` dönebilir, kullanıcı bunu görmezden gelebilir

**Test Mesaj Gönderme:**
- Panelden herhangi bir numaraya manuel mesaj atılabilir
- Mod seçilebilir (QR veya Business)

### 4.7. Canva Tasarım Entegrasyonu

**Ekran:** `/dashboard/canva`

**Akış:**
1. Kullanıcı "Canva ile Bağlan" → OAuth akışı
2. Token `CanvaConfig.accessToken`'da saklanır
3. `GET /api/canva/templates` → kullanıcının şablonları
4. Post oluşturulduğunda:
   - AI post metnini üretir
   - `extractImageTextForCanva(placeholders, post)` → her placeholder için metin
   - `fillCanvaTemplate(userId, post)` → Canva Autofill API'ye gönder
   - Sonuç: design_id + export_url (PNG/JPG)
5. Export URL `Post.mediaUrls`'e eklenir, otomatik paylaşımda görsel olarak kullanılır

**Nt Web'den farkı:** Nt Web'de **görsel üretimi yok**. ATBSocialMedia Canva ile marka tutarlılığı sağlar.

### 4.8. Gösterge Paneli (Dashboard)

**Ekran:** `/dashboard` (`/dashboard/page.tsx`)

**6 KPI Kartı:**
- Toplam gönderi sayısı
- Yayında olan
- Onay bekleyen
- Aktif haber kaynağı
- AI kişilik sayısı
- Bağlı sosyal hesap

**"Şimdi İçerik Üret" Butonu:**
- Tek tıkla AI'dan taslak istenir
- Persona'ya göre seçilen nişten haber çekilir, çevrilir, formatlanır
- Onay akışına düşer

**Son Gönderiler Listesi:**
- 10 son post, durum badge'i ile
- Tıklayınca takvim sayfasına yönlenir

### 4.9. Ayarlar

**Ekran:** `/dashboard/settings`

**Bölümler:**
1. **Otonom Mod Seçimi** (radio):
   - Tam Otonom (FULLY_AUTONOMOUS)
   - Onay Destekli (APPROVAL) — önerilen
2. **Bildirim Tercihleri:**
   - Telegram bot token + chat ID
   - SMTP ayarları
3. **Genel:**
   - Varsayılan dil
   - Varsayılan günlük limit
   - Varsayılan bekleme süresi

### 4.10. Zamanlayıcı (Scheduler)

**Servis:** `backend/src/services/scheduler.ts`

| Cron | İş |
|---|---|
| `*/5 * * * *` | Aktif haber kaynaklarını tara |
| `*/2 * * * *` | Zamanı gelen onaylanmış gönderileri yayınla |
| `0 */6 * * *` | 30 günden eski kullanılmış haberleri temizle |

**Nt Web'den farkı:** Nt Web'te Windows Task Scheduler'a bağımlılık var. ATBSocialMedia'da cron **sunucu tarafında** çalışır; platform bağımsız.

---

## 5. Yapay Zeka Davranış Kuralları (Prompt Tasarımı)

### 5.1. İçerik Üretim Prompt'u (System)

```
Sen bir sosyal medya içerik editörüsün.
Görevin: kaynak haberi, "persona" tonuyla hedef dile uygun, 
ilgi çekici, kısa ve öz bir sosyal medya gönderisine dönüştürmek.

Kurallar:
- Başlık: Maksimum 90 karakter, dikkat çekici.
- Metin: 600-1200 karakter, akıcı, kişisel ama profesyonel.
- Ton: {persona.tone}
- Dil: {lang}
- Ek kurallar: {persona.voiceRules}
- Yasaklı konular: {persona.forbiddenTopics}
- Sonunda 4-6 hashtag ekle.
- Sadece JSON döndür (response_mime_type: application/json).
```

### 5.2. WhatsApp Yanıt Prompt'u

```
Sen "{persona.name}" adlı bir müşteri temsilcisi / asistanısın.
Ton: {persona.tone}
...

Gelen mesajı analiz et, uygun, kısa, doğal bir yanıt üret.
- Eğer ödeme, güvenlik, hukuk, öfke → isCritical: true
- Aksi durumda → isCritical: false
- Sadece JSON.
```

### 5.3. Güvenlik Katmanları

1. **Yanlış bilgi önleme:** Kaynak haberde olmayan iddialar üretmesin. Prompt'ta "sadece verilen bilgiyi kullan" vurgusu.
2. **Ton kayması:** Persona kilidi — farklı bir kişiliğe dönüşmesin.
3. **Çıktı doğrulama:** Her Gemini yanıtı Zod şemasıyla validate edilir. Parse hatası → fallback mesaj.
4. **Token limiti:** 4000 karakter üstü kaynak içerik kesilir.

---

## 6. Güvenlik ve Gizlilik

| Konu | Uygulama |
|---|---|
| Platform şifreleri | OAuth token tercih edilir; şifre modu sadece QR/Baileys için (AES-256 ile `WA_SESSION_PATH` şifreli) |
| API anahtarları | `.env` (git'te ignore). Prod'da **HashiCorp Vault** veya **AWS Secrets Manager** önerilir |
| Webhook imza doğrulama | Meta (WhatsApp), Twitter CRC, LinkedIn — ZORUNLU |
| CORS | Whitelist: `CORS_ORIGIN` env |
| Rate limit | 60sn'de 120 istek / IP (varsayılan, arttırılabilir) |
| Helmet.js | Aktif |
| Input validation | Tüm endpoint'lerde Zod |
| SQL injection | Prisma ORM (parametreli sorgu) |
| XSS | React default escaping; kullanıcı girdisi HTML render edilmez |
| CSRF | JWT token Authorization header'da, cookie kullanılmaz |

---

## 7. Gözlemlenebilirlik (Observability)

- **Loglama:** Pino + Pino-pretty (geliştirme), JSON (prod)
- **Metrik:** Prometheus exporter opsiyonel (eklenecek)
- **Hata takibi:** Sentry entegrasyonu (eklenecek)
- **Audit log:** `AuditLog` tablosu — kim, ne zaman, ne yaptı

---

## 8. Dağıtım (Deployment)

### 8.1. Önerilen Mimari

```
                    ┌──────────────┐
                    │  CloudFront  │
                    │  (CDN + WAF) │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌────────────┐           ┌────────────┐
       │  Vercel    │           │  Railway / │
       │  Frontend  │           │  Render    │
       │  (Next.js) │           │  (Backend) │
       └────────────┘           └─────┬──────┘
                                     │
                          ┌──────────┼──────────┐
                          ▼          ▼          ▼
                    ┌─────────┐ ┌────────┐ ┌────────┐
                    │ Postgres│ │ Redis  │ │ S3/R2  │
                    │ Neon/   │ │Upstash │ │ (medya)│
                    │ Supabase│ │        │ │        │
                    └─────────┘ └────────┘ └────────┘
```

### 8.2. WhatsApp Webhook

- Public HTTPS gerekli (Let's Encrypt + Caddy/Nginx)
- WhatsApp için ngrok da olur (geliştirme)

### 8.3. Medya Depolama

- Şu an: harici URL (NewsItem.imageUrl) — indirip yeniden host etmiyor
- Gelecek: S3/R2'ye kopyala + CDN

---

## 9. Nt Web Social Bot'tan Aktarılacak Özellikler

Nt Web'in PHP+Python yapısından öğrendiğimiz ve ATBSocialMedia'ya eklemeye değer bulduğumuz özellikler:

| # | Nt Web Özelliği | ATBSocialMedia Karşılığı | Durum |
|---|---|---|---|
| 1 | RSS'den otomatik içerik çekme | `newsFetcher` servisi (RSS + Web Scrape + API) | ✅ Mevcut |
| 2 | Kuyruk (queue) ile sıralı paylaşım | `Post.status` state machine | ✅ Mevcut |
| 3 | Paylaşılanlar geçmişi | `/dashboard/calendar` (PUBLISHED tab) | ✅ Mevcut |
| 4 | Tek platformda tekrar paylaşım | `PostTarget` per-platform retry | ✅ Mevcut |
| 5 | Atlama (skipped) durumu | `REJECTED` status + filter | ✅ Mevcut |
| 6 | AES-256 ile şifreleme | `secret.key` eşdeğeri: şifreli credential store (TODO) | ⏳ Eklenecek |
| 7 | Per-platform rate limit | Cron tabanlı kuyruk | ✅ Mevcut (farklı mekanizma) |
| 8 | Screenshot on error | Sadece Playwright modunda (gelecekte) | ⏳ Planlı |
| 9 | Headless browser simülasyonu | API-first; Playwright sadece Instagram fallback | ⚠️ Kısmen |
| 10 | Windows Task Scheduler | node-cron (server-side) | ✅ Daha iyi |
| 11 | Karakter kırpma (Twitter 280) | publishTwitter fonksiyonu (henüz kırpma yok) | ⏳ Eklenecek |
| 12 | Bot lock dosyası (çakışma önleme) | BullMQ distributed lock (henüz kullanılmıyor) | ⏳ Eklenecek |
| 13 | Self-healing (devam et, çökme) | try/catch her publish fonksiyonunda + DB log | ✅ Mevcut |
| 14 | Bot durumu logları (DB) | `social_logs` eşdeğeri: `AuditLog` (kısmi) | ⏳ Genişletilecek |
| 15 | Sitemap/RSS feed | NewsFetcher RSS | ✅ Mevcut |
| 16 | Görsel optimizasyonu (PIL) | Şu an yok (harici URL kullanılıyor) | ⏳ Eklenecek (sharp) |
| 17 | Kullanıcı kilitlenme koruması | Onay modu + rate limit | ✅ Mevcut |

---

## 10. Yol Haritası (Önceliklendirilmiş)

### **Sprint 0 — MVP Çalıştırma (1-2 gün)**
- [ ] PostgreSQL + Redis olmadan in-memory mock mod
- [ ] `.env`'e gerçek Gemini key
- [ ] Landing + Dashboard çalışır hale getir
- [ ] Manuel içerik üretimi testi

### **Sprint 1 — Yayın Pipeline'ı (3-5 gün)**
- [ ] Twitter API OAuth flow
- [ ] publishToPlatform testleri
- [ ] Per-platform retry butonu
- [ ] Screenshot-on-error (Playwright modülü) — opsiyonel

### **Sprint 2 — WhatsApp Prod (3-5 gün)**
- [ ] Baileys reconnect iyileştirmesi
- [ ] Business API webhook receiver
- [ ] SSE QR akışı stabilize
- [ ] Test mesaj gönder/al smoke testi

### **Sprint 3 — Canva + Görsel (2-3 gün)**
- [ ] OAuth callback düzeltme
- [ ] Autofill polling
- [ ] Otomatik görsel üretimi post pipeline'a entegre

### **Sprint 4 — Çoklu Kullanıcı + Auth (3-5 gün)**
- [ ] NextAuth.js
- [ ] OWNER/ADMIN/EDITOR rolleri
- [ ] Multi-tenant (subdomain veya path)

### **Sprint 5 — Gözlemlenebilirlik (1-2 gün)**
- [ ] Sentry
- [ ] Pino prod log aggregation
- [ ] `/api/health` → uptime monitor

---

## 11. Başarı Metrikleri (KPI)

| Metrik | Hedef |
|---|---|
| Günlük üretilen taslak | 20+ |
| Onaylanma oranı | %80+ |
| Yayın başarı oranı (platform başına) | %95+ |
| WhatsApp yanıt süresi (ortalama) | < 5 sn |
| Gemini API çağrı hata oranı | < %1 |
| API endpoint latency (p95) | < 300 ms |
| Aylık aktif kullanıcı (MAU) | 100+ (1. yıl hedefi) |

---

## 12. Açık Sorular ve Karar Bekleyenler

1. **Çoklu dil:** UI sadece TR mi, yoksa EN desteği de?
2. **Lisanslama:** MIT + ücretli SaaS tier mı, tamamen ücretsiz mi?
3. **Çoklu kullanıcı:** Bireysel kullanım mı, ekip/takım mı?
4. **Video içerik:** TikTok için video üretimi eklenecek mi (FFmpeg pipeline)?
5. **Medya hosting:** S3/R2 entegrasyonu ne zaman?
6. **AI modeli:** Sadece Gemini mi, yoksa GPT-4o / Claude da seçenek olarak mı?

---

## 13. Sonuç

ATBSocialMedia; **Nt Web Social Bot'un basit, kanıtlanmış otomasyon mantığını** (RSS → kuyruk → per-platform paylaşım → retry) **modern AI-native bir stack** ile (Gemini, Next.js, Prisma, TypeScript) birleştirir. Eklenen kritik özellikler:

- AI içerik üretimi ve çeviri
- Onay destekli mod (hesap yasaklanma riskini minimize eder)
- Çoklu niş ve kişilik yönetimi
- WhatsApp otonom yanıtlama
- Canva görsel otomasyonu
- Modern, karanlık temalı premium panel
- TypeScript + Zod ile tip güvenliği

Bu, Nt Web'in "sadece paylaşan" botundan **"düşünen, çeviren, yanıtlayan ve onay alan"** asistanına geçiş niteliğindedir.
