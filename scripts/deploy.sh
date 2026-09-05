#!/usr/bin/env bash
#
# Despliega o actualiza InternetPerla en el VPS.
#
#   bash scripts/deploy.sh            # git pull + build + up
#   bash scripts/deploy.sh --no-pull  # sólo reconstruye lo que hay en disco
#
# Se ejecuta desde la raíz del repositorio, con un `.env` ya configurado.

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
PULL=1
[[ "${1:-}" == "--no-pull" ]] && PULL=0

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f .env ]] || fail "Falta .env. Cópialo de .env.prod.example y complétalo."

# Comprobar que no quedaron valores de plantilla sin rellenar.
if grep -qE '^[A-Z_]+=CAMBIAME' .env; then
  grep -nE '^[A-Z_]+=CAMBIAME' .env
  fail "Hay variables sin rellenar en .env (las de arriba)."
fi
for var in FRONTEND_DOMAIN BACKEND_DOMAIN ACME_EMAIL DB_USERNAME DB_PASSWORD DB_DATABASE JWT_SECRET; do
  grep -qE "^${var}=.+" .env || fail "Falta ${var} en .env"
done

# Un backup antes de tocar nada, si ya existe una base con datos.
if $COMPOSE ps --status running --services 2>/dev/null | grep -qx db; then
  log "Respaldando la base antes de actualizar"
  bash scripts/backup-db.sh || fail "El backup falló; se aborta el despliegue."
fi

if [[ $PULL -eq 1 ]] && [[ -d .git ]]; then
  log "Actualizando código"
  git pull --ff-only
fi

log "Construyendo imágenes"
$COMPOSE build

log "Levantando servicios"
$COMPOSE up -d --remove-orphans

log "Esperando a que el backend responda"
# `docker inspect` sobre el id del contenedor funciona en cualquier versión de
# Compose; el formato de `compose ps` ha cambiado entre versiones.
state=""
for _ in $(seq 1 60); do
  cid=$($COMPOSE ps -q backend 2>/dev/null || true)
  if [[ -n "$cid" ]]; then
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "$cid" 2>/dev/null || true)
    [[ "$state" == "healthy" || "$state" == "sin-healthcheck" ]] && break
  fi
  sleep 3
done
[[ "$state" == "healthy" || "$state" == "sin-healthcheck" ]] || {
  $COMPOSE logs --tail 60 backend
  fail "El backend no llegó a estado healthy (estado: ${state:-desconocido}). Log arriba."
}

log "Liberando imágenes viejas"
docker image prune -f >/dev/null

log "Estado"
$COMPOSE ps

FRONTEND_DOMAIN=$(grep -E '^FRONTEND_DOMAIN=' .env | cut -d= -f2-)
cat <<EOF

Despliegue completo: https://${FRONTEND_DOMAIN}

Si es la primera vez, crea el usuario administrador:
  docker compose -f docker-compose.prod.yml exec backend npm run seed:prod
y cambia de inmediato la contraseña de admin@example.com desde la app.
EOF
