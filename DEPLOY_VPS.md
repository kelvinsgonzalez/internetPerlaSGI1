# Despliegue en VPS — InternetPerla

Guía completa para migrar el proyecto desde Render/Netlify/Neon a un único VPS usando Docker Compose + Traefik + Let's Encrypt.

---

## 1. Información que necesito de ti

Antes de poder cerrar la migración, debes proporcionar / decidir lo siguiente. **Cada elemento marcado con `[PENDIENTE]` debe quedar resuelto antes del primer despliegue.**

### 1.1 Servidor (VPS)
- `[PENDIENTE]` Proveedor del VPS (DigitalOcean, Hetzner, Contabo, AWS Lightsail, etc.).
- `[PENDIENTE]` IP pública del VPS.
- `[PENDIENTE]` Usuario SSH con privilegios sudo (recomendado: NO usar root directo).
- `[PENDIENTE]` Sistema operativo (recomendado: Ubuntu 22.04 LTS o 24.04 LTS).
- `[PENDIENTE]` Recursos mínimos sugeridos: 2 vCPU, 4 GB RAM, 40 GB SSD.

### 1.2 Dominio y DNS
- `[PENDIENTE]` Dominio principal (ej. `internetperla.com`).
- `[PENDIENTE]` Subdominio para frontend (ej. `app.internetperla.com` o el dominio raíz).
- `[PENDIENTE]` Subdominio para backend / API (ej. `api.internetperla.com`).
- `[PENDIENTE]` Acceso al panel DNS del proveedor (Cloudflare, Namecheap, etc.) para crear los registros `A` apuntando a la IP del VPS.

### 1.3 Base de datos
- ¿Se migra la base de datos actual de Neon al VPS o se mantiene Neon?
  - Opción A (recomendada): Postgres en Docker dentro del VPS (incluida en `docker-compose.prod.yml`).
  - Opción B: Seguir usando Neon (solo se necesita el `DATABASE_URL` y `DB_SSL=true`).
- `[PENDIENTE]` Si se migra: necesito el dump actual de Neon (`pg_dump`) para restaurarlo.
- `[PENDIENTE]` Credenciales para el Postgres del VPS:
  - `DB_USERNAME`
  - `DB_PASSWORD` (mínimo 24 caracteres aleatorios)
  - `DB_DATABASE`

### 1.4 Secretos y variables
- `[PENDIENTE]` `JWT_SECRET` nuevo (mínimo 32 caracteres aleatorios). **No reutilizar el actual** porque está en `.env.local`.
- `[PENDIENTE]` `BUSINESS_TZ` (actualmente `America/Guatemala`, confirmar).
- `[PENDIENTE]` `AUTO_CLOSE_ENABLED` (`true` o `false`).
- `[PENDIENTE]` `VITE_MAPBOX_TOKEN` para el mapa de colaboradores. Conviene generar uno nuevo y revocar el actual (está commiteado en `apps/frontend/.env.local`).
- `[PENDIENTE]` Email para notificaciones de Let's Encrypt (`ACME_EMAIL`). Recibe avisos si un certificado falla renovación.

### 1.5 Backups
- `[PENDIENTE]` ¿Dónde se guardarán los backups? (mismo VPS, S3, Backblaze B2, rsync a otra máquina).
- `[PENDIENTE]` Frecuencia y retención (sugerido: diario, retención 14 días).

### 1.6 Otros
- `[PENDIENTE]` ¿Quién más tendrá acceso SSH al VPS? (lista de claves públicas).
- `[PENDIENTE]` ¿Se quiere monitoreo / alertas? (Uptime Kuma, Better Stack, etc.).

---

## 2. Cambios en código necesarios

> Estado de cada cambio: [HECHO] ya está aplicado en este repo, [PENDIENTE] hay que aplicarlo.

### 2.1 Frontend
- [HECHO] Nuevo `apps/frontend/Dockerfile` que compila con Vite y sirve con Nginx.
- [HECHO] `apps/frontend/nginx.conf` con fallback SPA (`try_files`) y caché de estáticos.
- [HECHO] Las variables `VITE_*` se inyectan en build time vía `ARG` del Dockerfile (ya están parametrizadas en `docker-compose.prod.yml`).

### 2.2 Backend
- [PENDIENTE] **CORS por variable de entorno.** Actualmente [apps/backend/src/main.ts:8-11](apps/backend/src/main.ts#L8-L11) tiene los orígenes hardcodeados. Hay que cambiarlo a leer `CORS_ORIGINS` (lista separada por comas). Te lo puedo aplicar cuando quieras.
- [PENDIENTE] **Migraciones TypeORM en lugar de `synchronize`.** En producción `DB_SYNC=false`. Ya existen 2 migraciones en `apps/backend/src/migrations/` pero el `app.module.ts` no las ejecuta automáticamente. Hay que añadir `migrationsRun: true` y un script `npm run migration:run`.
- [PENDIENTE] **Quitar el parche `jsonwebtoken`** del [apps/backend/Dockerfile:10-11](apps/backend/Dockerfile#L10-L11) si actualizamos `jsonwebtoken` y/o `@nestjs/jwt` a una versión que no necesite el parche. Se puede dejar tal cual si funciona, pero conviene investigar.
- [PENDIENTE] (Opcional) Healthcheck más completo en `/health` que valide conexión a DB.

### 2.3 Repositorio
- [PENDIENTE] Asegurar que `.env.local` y cualquier archivo con secretos NO esté en el historial de Git. Si fue commiteado en algún momento, **rotar todas las credenciales** y considerar `git filter-repo` para limpiar.
- [PENDIENTE] Añadir `.env` (sin `.local`) a `.gitignore` por si acaso (ya está cubierto por `.env*`).

---

## 3. Archivos nuevos en este repositorio

- [DEPLOY_VPS.md](DEPLOY_VPS.md) — este documento.
- [docker-compose.prod.yml](docker-compose.prod.yml) — orquestación de producción con Traefik + Postgres + backend + frontend.
- [apps/frontend/Dockerfile](apps/frontend/Dockerfile) — multistage build con Nginx (reemplaza el anterior).
- [apps/frontend/nginx.conf](apps/frontend/nginx.conf) — config de Nginx para SPA.

---

## 4. Procedimiento de despliegue paso a paso

### 4.1 Preparar el VPS

```bash
# Conectarse
ssh usuario@IP_DEL_VPS

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# (cerrar sesión y volver a entrar para que tome el grupo)

# Firewall básico
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# (Opcional pero recomendado) fail2ban
sudo apt install -y fail2ban
```

### 4.2 Configurar DNS

En tu proveedor de DNS, crear registros `A`:

| Tipo | Nombre | Valor          | TTL  |
|------|--------|----------------|------|
| A    | app    | IP_DEL_VPS     | 300  |
| A    | api    | IP_DEL_VPS     | 300  |

Esperar a que propaguen (`dig app.tu-dominio.com +short` debe devolver la IP).

### 4.3 Clonar repo y configurar `.env`

```bash
# En el VPS
git clone https://github.com/TU_USUARIO/internetperla.git
cd internetperla

# Crear el archivo de entorno de producción
cp .env.prod.example .env.prod   # (crearemos esta plantilla en el siguiente paso)
nano .env.prod
```

Contenido de `.env.prod` (rellenar con los valores acordados en la sección 1):

```dotenv
# Dominios
FRONTEND_DOMAIN=app.tu-dominio.com
BACKEND_DOMAIN=api.tu-dominio.com
ACME_EMAIL=tu-email@ejemplo.com

# Base de datos
DB_USERNAME=internetperla
DB_PASSWORD=CONTRASEÑA_FUERTE_AQUÍ
DB_DATABASE=internetperla
DB_SYNC=false

# JWT
JWT_SECRET=GENERA_UNA_CADENA_LARGA_ALEATORIA
JWT_EXPIRES_IN=7d

# Negocio
BUSINESS_TZ=America/Guatemala
AUTO_CLOSE_ENABLED=false

# Mapbox (frontend)
VITE_MAPBOX_TOKEN=pk.tu_token_de_mapbox
```

### 4.4 Primer despliegue

```bash
# Levantar todo (descarga imágenes, construye, arranca)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Ver logs
docker compose -f docker-compose.prod.yml logs -f
```

Traefik obtendrá el certificado de Let's Encrypt automáticamente la primera vez que se acceda a cada dominio por HTTPS.

### 4.5 Inicializar la base de datos

**Opción A — primera vez (sin datos previos):** activar temporalmente `DB_SYNC=true` en `.env.prod`, levantar, ejecutar el seed, y volver a `false`:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed
```

Luego `DB_SYNC=false` y `docker compose -f docker-compose.prod.yml up -d backend`.

**Opción B — restaurar desde Neon:**

```bash
# Subir el dump al VPS
scp dump.sql usuario@IP:/tmp/

# Restaurar
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U $DB_USERNAME -d $DB_DATABASE < /tmp/dump.sql
```

### 4.6 Verificación

- `https://api.tu-dominio.com/api/v1/health` debe responder `{ "status": "ok" }`.
- `https://app.tu-dominio.com` debe cargar el login.
- Login + WebSocket: abrir DevTools → Network → comprobar que la conexión WS a `wss://api.tu-dominio.com/socket.io/` se establece.

---

## 5. Operación

### 5.1 Actualizaciones

```bash
cd ~/internetperla
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 5.2 Backups de Postgres

Crear `/etc/cron.daily/internetperla-backup`:

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/internetperla
mkdir -p $BACKUP_DIR
docker compose -f /home/usuario/internetperla/docker-compose.prod.yml exec -T db \
  pg_dump -U internetperla internetperla | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +14 -delete
```

```bash
sudo chmod +x /etc/cron.daily/internetperla-backup
```

### 5.3 Logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f traefik
```

### 5.4 Reinicio de servicios

```bash
docker compose -f docker-compose.prod.yml restart backend
```

---

## 6. Troubleshooting

| Síntoma | Causa probable | Solución |
|--------|----------------|----------|
| Certificado SSL no se emite | DNS no propagado o puerto 80 cerrado | Verificar `dig`, abrir 80/tcp en firewall del VPS y del proveedor |
| Frontend carga pero API falla con CORS | `CORS_ORIGINS` no incluye el dominio | Editar `main.ts` (sección 2.2) o añadir el dominio al array |
| WebSocket no conecta | Proxy bloqueando upgrade | Traefik soporta WS por defecto; revisar que `VITE_SOCKET_URL` use `https://` |
| `DB connection refused` al primer arranque | Backend levanta antes que DB | El compose ya tiene `depends_on: condition: service_healthy`, esperar |
| Imagen muy grande | Cache de Docker | `docker system prune -af` |

---

## 7. Roadmap de hardening (post-despliegue)

1. Migraciones TypeORM en lugar de `synchronize`.
2. CORS desde variable de entorno.
3. Rate limiting en el backend (`@nestjs/throttler`).
4. Logs centralizados (Loki + Grafana, o un servicio externo).
5. Monitoreo de uptime (Uptime Kuma corriendo en el mismo VPS).
6. Renovación automática de claves SSH y rotación de `JWT_SECRET`.
7. Considerar Cloudflare delante para DDoS / cache.
