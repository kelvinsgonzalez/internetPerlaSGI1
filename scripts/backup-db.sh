#!/usr/bin/env bash
#
# Respalda la base de datos a un archivo comprimido con retención por días.
#
#   bash scripts/backup-db.sh
#
# Pensado también para cron:
#   0 3 * * * cd /home/deploy/internetperla && bash scripts/backup-db.sh >> /var/log/ip-backup.log 2>&1

set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/internetperla}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE="docker compose -f docker-compose.prod.yml"

[[ -f .env ]] || { echo "Falta .env" >&2; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/internetperla-$STAMP.sql.gz"

# pg_dump se ejecuta dentro del contenedor: la base no expone puertos al host.
$COMPOSE exec -T db pg_dump -U "$DB_USERNAME" -d "$DB_DATABASE" --clean --if-exists \
  | gzip -9 > "$OUT"

# Un dump vacío o truncado es peor que no tener backup: verifícalo.
if [[ ! -s "$OUT" ]] || ! gzip -t "$OUT" 2>/dev/null; then
  rm -f "$OUT"
  echo "ERROR: el backup salió vacío o corrupto" >&2
  exit 1
fi

echo "Backup: $OUT ($(du -h "$OUT" | cut -f1))"

find "$BACKUP_DIR" -name 'internetperla-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Retención: se conservan los últimos $RETENTION_DAYS días"

# Los archivos subidos (pruebas de tareas) viven en un volumen aparte.
# Compose lo nombra "<proyecto>_uploads", y el proyecto es por defecto el
# nombre de la carpeta, así que se deriva en vez de fijarlo a mano.
PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_-')}"
UPLOADS_VOL="${PROJECT}_uploads"

if docker volume inspect "$UPLOADS_VOL" >/dev/null 2>&1; then
  UPLOADS_OUT="$BACKUP_DIR/uploads-$STAMP.tar.gz"
  docker run --rm -v "$UPLOADS_VOL":/data:ro -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/$(basename "$UPLOADS_OUT")" -C /data .
  echo "Uploads: $UPLOADS_OUT ($(du -h "$UPLOADS_OUT" | cut -f1))"
  find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
else
  echo "Aviso: no existe el volumen '$UPLOADS_VOL'; revisa 'docker volume ls'."
fi
