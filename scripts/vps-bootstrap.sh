#!/usr/bin/env bash
#
# Prepara un VPS Contabo con Ubuntu 24.04 LTS para alojar InternetPerla.
# Idempotente: puedes ejecutarlo varias veces sin romper nada.
#
#   sudo bash scripts/vps-bootstrap.sh [usuario-de-despliegue]
#
# Deja instalado: Docker + Compose, ufw, fail2ban, actualizaciones de
# seguridad automáticas, zona horaria y swap.

set -euo pipefail

DEPLOY_USER="${1:-deploy}"
BUSINESS_TZ="${BUSINESS_TZ:-America/Guatemala}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

if [[ $EUID -ne 0 ]]; then
  echo "Ejecuta como root: sudo bash $0" >&2
  exit 1
fi

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

log "Actualizando el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

log "Instalando utilidades base"
# Sin cliente de Postgres en el host: backup-db.sh y restore-db.sh usan el
# pg_dump/psql del propio contenedor, que siempre coincide con el servidor.
apt-get install -y ca-certificates curl gnupg git ufw fail2ban \
  unattended-upgrades

log "Zona horaria -> ${BUSINESS_TZ}"
timedatectl set-timezone "${BUSINESS_TZ}"

log "Actualizaciones de seguridad automáticas"
dpkg-reconfigure -f noninteractive unattended-upgrades

# Contabo entrega los VPS sin swap. El build del frontend (Vite + Mapbox)
# consume bastante memoria y en los planes de 4 GB puede quedarse corto.
if ! swapon --show | grep -q .; then
  log "Creando swap de ${SWAP_SIZE}"
  fallocate -l "${SWAP_SIZE}" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  log "Ya hay swap configurada, se omite"
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker ya está instalado"
fi
systemctl enable --now docker

log "Usuario de despliegue: ${DEPLOY_USER}"
if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
  # Copia las claves SSH de root para no quedarte fuera del servidor.
  if [[ -f /root/.ssh/authorized_keys ]]; then
    install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
    install -m 600 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" \
      /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  fi
fi
usermod -aG docker,sudo "${DEPLOY_USER}"

log "Firewall (ufw)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "fail2ban"
systemctl enable --now fail2ban

cat <<EOF

────────────────────────────────────────────────────────────────────────
VPS listo.

Ojo con ufw: Docker escribe sus propias reglas en iptables y se salta ufw
para los puertos que publica. En este despliegue sólo Traefik publica el 80
y el 443, que de todas formas deben estar abiertos, y Postgres no publica
ninguno. No añadas 'ports:' a la base de datos.

Siguientes pasos, ya como '${DEPLOY_USER}':

  su - ${DEPLOY_USER}
  git clone <url-del-repo> internetperla && cd internetperla
  cp .env.prod.example .env && nano .env && chmod 600 .env
  bash scripts/deploy.sh

Si acabas de añadir el usuario al grupo docker, cierra sesión y vuelve a
entrar para que tome el grupo.
────────────────────────────────────────────────────────────────────────
EOF
