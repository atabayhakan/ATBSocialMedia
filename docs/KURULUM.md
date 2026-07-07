# Kurulum Rehberi (Windows / PowerShell)

## 1. Araçlar

```powershell
# Node 20+ (LTS) — https://nodejs.org
node -v
npm -v

# PostgreSQL 14+
# https://www.postgresql.org/download/windows/
# Kurulum sırasında atb / atb / atbsocialmedia oluştur
psql -U postgres -c "CREATE USER atb WITH PASSWORD 'atb';"
psql -U postgres -c "CREATE DATABASE atbsocialmedia OWNER atb;"

# Redis 7+ (Memurai veya Microsoft'un Windows portu önerilir)
# https://github.com/microsoftarchive/redis/releases
# veya WSL2 üzerinden redis-server
redis-cli ping
# PONG dönmeli
```

## 2. Proje Kurulumu

```powershell
cd D:\ATBSocialMedia
npm install
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

## 3. Anahtar Servisler

### Google Gemini
1. https://aistudio.google.com/app/apikey
2. API key oluştur
3. `backend/.env` → `GEMINI_API_KEY=...`

### Canva Connect (opsiyonel)
1. https://www.canva.com/developers/apps
2. OAuth uygulaması oluştur
3. Redirect URI: `http://localhost:4000/api/canva/callback`
4. Scope: `design:content:read design:content:write asset:read asset:write`
5. Client ID/Secret'ı `backend/.env`'e ekle

### Meta WhatsApp Business (opsiyonel)
1. https://developers.facebook.com/apps
2. WhatsApp ürününü ekle
3. Test numarası al
4. Phone Number ID + Access Token → `backend/.env`

## 4. Veritabanı

```powershell
npm run db:generate
npm run db:push
# İsteğe bağlı GUI:
npm run db:studio
```

## 5. Geliştirme

```powershell
npm run dev
# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

## 6. İlk Akış

1. Frontend'i aç → "Panele Git"
2. **AI Kişilikler** → Bir tane oluştur (varsayılan olarak işaretle)
3. **Haber Kaynakları** → RSS ekle (örn: `https://techcrunch.com/feed/`)
4. **Haber Kaynakları** → "Tara" ile test et
5. **Genel Bakış** → "Şimdi İçerik Üret"
6. **İçerik Takvimi** → Onayla
7. **Sosyal Hesaplar** → Twitter/LinkedIn token'larını ekle
8. Zamanlayıcı otomatik yayınlar
9. **WhatsApp** → QR'ı okut (Yöntem A)

## 7. Sorun Giderme

- **"ECONNREFUSED 5432"** → PostgreSQL çalışmıyor
- **"Redis connection refused"** → redis-server başlat
- **"GEMINI_API_KEY invalid"** → anahtarı kontrol et, model adını güncelle
- **QR gelmiyor** → `WA_QR_ENABLED=true` mi?
- **Prisma hatası** → `npm run db:generate` çalıştır

## 8. Üretime Alma (özet)

- Backend: Docker (node:20-alpine), PM2 veya Railway/Render
- Frontend: Vercel veya Docker (standalone Next.js)
- Veritabanı: Supabase, Neon veya RDS
- Redis: Upstash veya Redis Cloud
- Reverse proxy: Caddy/Nginx + HTTPS
- WhatsApp Webhook: Public URL (ngrok da olur)
