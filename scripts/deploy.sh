#!/usr/bin/env bash
#
# Despliega o actualiza InternetPerla en el VPS.
#
#   bash scripts/deploy.sh            # git pull + build + up
#   bash scripts/deploy.sh --no-pull  # sólo reconstruye lo que hay en disco
#
# Se ejecuta desde la raíz del repositorio. Usa DOS archivos de entorno:
#   .env       -> lo interpola docker compose (credenciales de Postgres, Mapbox)
#   .env.prod  -> lo recibe el contenedor del backend vía `env_file`
#                 (JWT_SECRET, ADMIN_EMAIL, LEGACY_ADMIN_EMAIL, RETIRED_EMAILS)

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
PULL=1
[[ "${1:-}" == "--no-pull" ]] && PULL=0

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ -f .env ]] || fail "Falta .env. Cópialo de .env.prod.example y complétalo."
[[ -f .env.prod ]] || fail "Falta .env.prod (lo consume el backend vía env_file)."

# Comprobar que no quedaron valores de plantilla sin rellenar.
for f in .env .env.prod; do
  if grep -qE '^[A-Z_]+=CAMBIAME' "$f"; then
    grep -nE '^[A-Z_]+=CAMBIAME' "$f"
    fail "Hay variables sin rellenar en ${f} (las de arriba)."
  fi
done

# Las que interpola compose al leer docker-compose.prod.yml.
for var in DB_USERNAME DB_PASSWORD DB_DATABASE; do
  grep -qE "^${var}=.+" .env || fail "Falta ${var} en .env"
done
# Las que consume el backend dentro del contenedor. Sin JWT_SECRET no arranca;
# sin ADMIN_EMAIL el seed y la migración del administrador no saben qué cuenta
# usar.
for var in JWT_SECRET ADMIN_EMAIL; do
  grep -qE "^${var}=.+" .env.prod || fail "Falta ${var} en .env.prod"
done

# Un backup antes de tocar nada, si ya existe una base con datos.
if $COMPOSE ps --status running --services 2>/dev/null | grep -qx db-crm; then
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
  cid=$($COMPOSE ps -q backend-crm 2>/dev/null || true)
  if [[ -n "$cid" ]]; then
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "$cid" 2>/dev/null || true)
    [[ "$state" == "healthy" || "$state" == "sin-healthcheck" ]] && break
  fi
  sleep 3
done
[[ "$state" == "healthy" || "$state" == "sin-healthcheck" ]] || {
  $COMPOSE logs --tail 60 backend-crm
  fail "El backend no llegó a estado healthy (estado: ${state:-desconocido}). Log arriba."
}

log "Liberando imágenes viejas"
docker image prune -f >/dev/null

log "Estado"
$COMPOSE ps

cat <<EOF

Despliegue completo: https://iperla.online/crm

Si es la primera vez, crea el usuario administrador (usa ADMIN_EMAIL de
.env.prod; deja SEED_ADMIN_PASSWORD vacia y el seed imprimira una contrasena
aleatoria una sola vez):
  docker compose -f docker-compose.prod.yml exec backend-crm npm run seed:prod
Anotala, entra y cambiala desde Ajustes de Administracion -> Mi cuenta.

Si la base ya existia con un admin anterior, define LEGACY_ADMIN_EMAIL en
.env.prod: las migraciones lo trasladan solas a ADMIN_EMAIL al arrancar
(DB_MIGRATIONS_RUN=true) y ese correo queda retirado.
EOF
