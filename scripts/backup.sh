#!/usr/bin/env bash
# Gece yedeği: Postgres dump + WhatsApp oturumları. 14 gün saklanır.
# Cron: 30 3 * * * /opt/atbsocialmedia/scripts/backup.sh >> /var/log/atb-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="/var/backups/atb"
STAMP=$(date +%Y%m%d-%H%M)
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

# Postgres (docker container içinden)
docker exec atbsocialmedia-postgres-1 pg_dump -U atb -d atbsocialmedia \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

# WhatsApp oturum dosyaları (varsa)
WA_DIR="/opt/atbsocialmedia/backend/.wa-sessions"
if [ -d "$WA_DIR" ]; then
  tar -czf "$BACKUP_DIR/wa-sessions-$STAMP.tar.gz" -C "$(dirname "$WA_DIR")" "$(basename "$WA_DIR")"
fi

# Env dosyaları (ENCRYPTION_KEY dahil — bunsuz DB'deki şifreli token'lar çözülemez)
if [ -f /opt/atbsocialmedia/backend/.env ]; then
  tar -czf "$BACKUP_DIR/env-$STAMP.tar.gz" -C /opt/atbsocialmedia backend/.env
  chmod 600 "$BACKUP_DIR/env-$STAMP.tar.gz"
fi

# Eski yedekleri temizle
find "$BACKUP_DIR" -name '*.gz' -mtime +$KEEP_DAYS -delete

echo "$(date -Is) yedek tamam: db-$STAMP.sql.gz ($(du -h "$BACKUP_DIR/db-$STAMP.sql.gz" | cut -f1))"
