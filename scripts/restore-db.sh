#!/usr/bin/env bash
#
# Restaura la base de datos desde un dump de scripts/backup-db.sh.
# También sirve para migrar los datos desde Neon: genera el dump con
#   pg_dump "<DATABASE_URL_de_Neon>" --clean --if-exists | gzip > neon.sql.gz
# y restáuralo aquí.
#
#   bash scripts/restore-db.sh ~/backups/internetperla/internetperla-20260903-030000.sql.gz
#
# DESTRUCTIVO: reemplaza el contenido actual de la base.

set -euo pipefail

cd "$(dirname "$0")/.."

DUMP="${1:-}"
COMPOSE="docker compose -f docker-compose.prod.yml"

[[ -n "$DUMP" ]] || { echo "Uso: bash scripts/restore-db.sh <archivo.sql.gz>" >&2; exit 1; }
[[ -f "$DUMP" ]] || { echo "No existe el archivo: $DUMP" >&2; exit 1; }
[[ -f .env ]] || { echo "Falta .env" >&2; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

echo "Se va a SOBRESCRIBIR la base '$DB_DATABASE' con:"
echo "  $DUMP"
read -r -p "Escribe 'restaurar' para confirmar: " answer
[[ "$answer" == "restaurar" ]] || { echo "Cancelado."; exit 1; }

# El backend se detiene durante la restauración para que no escriba encima.
echo "==> Deteniendo backend"
$COMPOSE stop backend

echo "==> Restaurando"
gunzip -c "$DUMP" | $COMPOSE exec -T db psql -U "$DB_USERNAME" -d "$DB_DATABASE" -v ON_ERROR_STOP=1

echo "==> Aplicando migraciones pendientes"
$COMPOSE start backend
sleep 5
$COMPOSE exec -T backend npm run migration:run:prod || true

echo "==> Listo"
$COMPOSE ps
