#!/usr/bin/env bash
# =============================================================================
# PostgreSQL 每日备份（P1-10）
#
# 功能：pg_dump 逻辑备份 → gzip → 保留 14 天，自动清理过期备份。
# 数据源：Compose 的 db 服务（postgres:16）。备份文件落在宿主机 ./backups/。
#
# 用法：
#   ./scripts/backup-postgres.sh                 # 立即备份一次
#   BACKUP_DIR=/srv/tea/backups ./scripts/backup-postgres.sh
#
# cron 每日 02:00（与业务低谷错开；pg_dump 期间对读无锁，对写有短暂 MVCC 快照开销）：
#   0 2 * * * cd /srv/tea && ./scripts/backup-postgres.sh >> /var/log/tea-backup.log 2>&1
#
# 恢复演练（每月一次，验证备份可恢复；恢复到一次性临时库，不碰生产）：
#   docker compose exec -T db psql -U tea_user -d postgres -c "CREATE DATABASE tea_restore_test"
#   gunzip -c backups/tea_YYYYMMDD_HHMMSS.sql.gz \
#     | docker compose exec -T db psql -U tea_user -d tea_restore_test
#   docker compose exec -T db psql -U tea_user -d tea_restore_test -c "SELECT count(*) FROM records;"
#   docker compose exec -T db psql -U tea_user -d postgres -c "DROP DATABASE tea_restore_test"
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
POSTGRES_USER="${POSTGRES_USER:-tea_user}"
POSTGRES_DB="${POSTGRES_DB:-tea_ceremony}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/tea_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Compose 的 db 服务执行 pg_dump；-T 不分配 TTY，cron 下可正常运行
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$OUT_FILE"

# 备份文件非空校验（pg_dump 失败时 gzip 输出可能为空文件，需拦截）
if [ ! -s "$OUT_FILE" ]; then
  echo "错误：备份文件为空（pg_dump 可能失败），已保留但需人工检查：$OUT_FILE" >&2
  exit 1
fi

# 清理超过 KEEP_DAYS 的旧备份
find "$BACKUP_DIR" -name 'tea_*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "备份完成: $OUT_FILE（保留 ${KEEP_DAYS} 天）"
