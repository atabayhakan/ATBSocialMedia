#!/usr/bin/env bash
# Gece yedeği: Postgres dump + WhatsApp oturumları + sırlar. 14 gün saklanır.
# Cron: 30 3 * * * /opt/atbsocialmedia/scripts/backup.sh >> /var/log/atb-backup.log 2>&1
set -euo pipefail

# Şifreli veri (DB dump, WA oturumları) ile şifreleme anahtarı (.env → ENCRYPTION_KEY)
# AYRI dizinlerde tutulur: aynı yerde dururlarsa at-rest şifreleme anlamsızlaşır
# (anahtar + ciphertext birlikte sızar). Sır dizini offsite'a ayrıca taşınmalı.
DATA_DIR="/var/backups/atb"            # DB dump + WA oturumları
SECRET_DIR="/var/backups/atb-secrets"  # .env (ENCRYPTION_KEY dahil)
STAMP=$(date +%Y%m%d-%H%M)
KEEP_DAYS=14

# Yedek dizinlerini yalnız root okuyabilsin
mkdir -p "$DATA_DIR" "$SECRET_DIR"
chmod 700 "$DATA_DIR" "$SECRET_DIR"

# Postgres (docker container içinden)
docker exec atbsocialmedia-postgres-1 pg_dump -U atb -d atbsocialmedia \
  | gzip > "$DATA_DIR/db-$STAMP.sql.gz"
chmod 600 "$DATA_DIR/db-$STAMP.sql.gz"

# WhatsApp oturum dosyaları (varsa)
WA_DIR="/opt/atbsocialmedia/backend/.wa-sessions"
if [ -d "$WA_DIR" ]; then
  tar -czf "$DATA_DIR/wa-sessions-$STAMP.tar.gz" -C "$(dirname "$WA_DIR")" "$(basename "$WA_DIR")"
  chmod 600 "$DATA_DIR/wa-sessions-$STAMP.tar.gz"
fi

# Env dosyası (ENCRYPTION_KEY dahil — bunsuz DB'deki şifreli token'lar çözülemez)
# ayrı sır dizinine yazılır.
if [ -f /opt/atbsocialmedia/backend/.env ]; then
  tar -czf "$SECRET_DIR/env-$STAMP.tar.gz" -C /opt/atbsocialmedia backend/.env
  chmod 600 "$SECRET_DIR/env-$STAMP.tar.gz"
fi

# Eski yedekleri temizle (her iki dizinde)
find "$DATA_DIR" "$SECRET_DIR" -name '*.gz' -mtime +$KEEP_DAYS -delete

echo "$(date -Is) yedek tamam: db-$STAMP.sql.gz ($(du -h "$DATA_DIR/db-$STAMP.sql.gz" | cut -f1))"
