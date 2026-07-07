# Network Quest — Manuel Test Adımları

PowerShell'i açın (D:\ATBSocialMedia dizininde) ve şu komutu çalıştırın:

```powershell
# 1) Backend'i ayrı bir terminalde başlatın
cd D:\ATBSocialMedia\backend
$env:USE_MOCK = "true"
npx tsx src/server.ts
```

Backend hazır olduğunda şu logları göreceksiniz:
```
✅ PostgreSQL bağlantısı başarılı
✅ Redis bağlantısı başarılı
⏰ Scheduler başlatıldı
🚀 Backend 4000 portunda çalışıyor
```

Şimdi başka bir terminalde frontend'i başlatın:

```powershell
cd D:\ATBSocialMedia\frontend
npm run dev
```

Frontend hazır olduğunda:
```
▲ Next.js 14.2.13
- Local: http://localhost:3000
✓ Ready
```

## Test Adımları

1. **Tarayıcıda** `http://localhost:3000/dashboard/network-quest` adresine gidin.
2. **Adım 1:** "Hybrid" kartına tıklayın → otomatik Adım 2'ye geçer.
3. **Adım 2:** Width slider'ı 4'ten 6'ya kaydırın → ağaç önizlemesi güncellenir.
4. **Adım 3:** "Sonsuz derinlik" checkbox'ını işaretleyin → depth ∞ olur.
5. **Adım 4:** Seviye 1'i %15 yapın, toplam %100'ü aşarsa uyarı çıkar.
6. **Adım 5:** "+ Rütbe Ekle" → Bronze (PV 500, GV 5000, 2 kol, +3%).
7. **Adım 6:** Fast Start bonusuna %10 yazın.
8. **Adım 7:** "Planı Kaydet" butonuna basın.
9. **Bildirim:** "Plan başarıyla kaydedildi" toast'ı çıkmalı.

## API Doğrulama (curl veya Postman)

```bash
# Listele
curl http://localhost:4000/api/compensation-plans -H "x-user-id: demo-user"

# Oluştur
curl -X POST http://localhost:4000/api/compensation-plans \
  -H "x-user-id: demo-user" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Plan","method":"UNILEVEL","width":5,"depth":5,"depthUnlimited":false,"config":{}}'
```

## Dosya Yapısı (oluşturulanlar)

```
D:\ATBSocialMedia\
├── backend\
│   ├── prisma\schema.prisma                  (CompensationPlan modeli eklendi)
│   └── src\
│       ├── routes\compensationPlans.ts       (YENİ - 5 endpoint)
│       └── server.ts                         (route mount eklendi)
└── frontend\
    └── src\
        ├── app\dashboard\network-quest\
        │   ├── page.tsx                      (YENİ - orchestrator)
        │   ├── types.ts                      (YENİ)
        │   ├── Stepper.tsx                   (YENİ)
        │   ├── TreePreview.tsx               (YENİ - SVG)
        │   └── steps\
        │       ├── Step1Method.tsx           (YENİ)
        │       ├── Step2Width.tsx            (YENİ)
        │       ├── Step3Depth.tsx            (YENİ)
        │       ├── Step4Commission.tsx       (YENİ)
        │       ├── Step5Ranks.tsx            (YENİ)
        │       ├── Step6Bonuses.tsx          (YENİ)
        │       └── Step7Review.tsx           (YENİ)
        └── components\sidebar.tsx            (Network Quest linki eklendi)
```

## ATB System Durumu

✅ **Hiçbir değişiklik yapılmadı.** Tüm dosyalar orijinal halinde.
Verification:
```bash
Get-ChildItem -Path "D:\ATB System" -Recurse -File |
  Where-Object { $_.FullName -match "networkQuest|NetworkQuest|CompensationPlan|compensation_plans" }
# (hiçbir sonuç dönmemeli)
```
