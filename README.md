# InternetPerla (Monorepo)

Sistema de administración + app web para gestión de colaboradores, inventario, tareas y finanzas.

- Backend: NestJS + TypeORM + PostgreSQL + JWT (roles `ADMIN`/`USER`).
- Frontend: React + Vite + TypeScript + Tailwind.
- Realtime: Socket.IO.

Aplicación web (producción)
- https://internetperla.netlify.app/login

## Estructura
- `apps/backend` — API REST + WebSockets
- `apps/frontend` — SPA (Vite)
- `docker-compose.yml` — orquesta DB + backend + frontend

## Requisitos
- Node.js 20+ (recomendado 22 LTS, que es la versión de las imágenes Docker)
- Docker (opcional para levantar todo con compose)

## Arranque rápido con Docker

> Postgres pasó de la 15 a la **17** (la misma versión que usaba Neon, para que
> los dumps se restauren sin conversiones). Si vienes de un volumen creado con
> la 15, Postgres no arrancará sobre él: respáldalo y recréalo con
> `docker compose down && docker volume rm <proyecto>_ip_db_data`.

1) (Opcional) Copia `apps/backend/.env.example` a `apps/backend/.env` y ajusta valores si lo necesitas.
2) Ejecuta: `docker compose up --build`
3) URLs:
   - Backend: `http://localhost:3000/api/v1` (health: `/health`)
   - Frontend (preview): `http://localhost:3001` (o `:5173` si usas override)

## Arranque local (sin Docker)

### Backend
1) `cd apps/backend`
2) Crea `.env` desde `.env.example` (claves abajo).
3) `npm install`
4) Desarrollo: `npm run start:dev`
5) (Opcional) Datos iniciales: `npm run seed`

Variables backend principales:
- `PORT=3000`
- Postgres: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.
- Alternativa: `DATABASE_URL` (Neon/Render).
- `DB_SSL=true|false` (en Neon/Render normalmente `true`).
- `DB_SYNC=true|false` (solo desarrollo; en producción usar migraciones o activar temporalmente para sincronizar y volver a `false`).
- `JWT_SECRET`, `JWT_EXPIRES_IN`.
- `BUSINESS_TZ` (IANA, ej. `America/Guatemala`).

### Frontend
1) `cd apps/frontend`
2) Crea `.env` desde `.env.example` y ajusta.
3) `npm install`
4) `npm run dev` (Vite en `http://localhost:5173`)

Variables frontend:
- `VITE_API_URL` — URL absoluta del API (ej. `http://localhost:3000/api/v1` o dominio de Render).
- `VITE_API_BASE_URL` — alternativa relativa (ej. `/api/v1`, Vite hará proxy según `vite.config.ts`).
- `VITE_SOCKET_URL` — origen para Socket.IO (ej. `http://localhost:3000`).
- `VITE_MAPBOX_TOKEN` — token de Mapbox usado por el mapa de colaboradores.

Notas:
- Si no configuras `VITE_API_URL`, el frontend usa el proxy de Vite a `http://localhost:3000` durante desarrollo.
- El `.env.example` histórico incluía Google Maps; ahora el mapa usa Mapbox (`VITE_MAPBOX_TOKEN`).

## Autenticación y roles
- Registro: `POST /api/v1/auth/register` `{ name, email, password }`
- Login: `POST /api/v1/auth/login` `{ email, password }`
- Roles: `ADMIN`, `USER`

## Módulos principales
- Clientes: CRUD `/api/v1/customers`
- Inventario: items, almacenes, stocks y movimientos `/api/v1/inventory/*`
- Tareas: asignación y gestión `/api/v1/tasks`
- Finanzas: corte de caja diario `/api/v1/finance/*`

## Endpoints clave
- `GET /api/v1/health` → `{ status: 'ok' }`
- `POST /api/v1/auth/login`, `POST /api/v1/auth/register`

## Credenciales de ejemplo (seed local)
- `admin@example.com` / `123456` (ADMIN)
- `user@example.com` / `123456` (USER)

Sólo para la base de datos local que crea `npm run seed`. **Nunca** documentes aquí
credenciales de cuentas reales de producción: este archivo se versiona.

Para promover a un usuario a ADMIN en producción, cambia su `role` directamente en
la base de datos o hazlo desde el panel con una cuenta ADMIN existente.

## Migraciones

Las migraciones viven en `apps/backend/src/migrations` y están registradas en el
DataSource. No se ejecutan solas salvo que definas `DB_MIGRATIONS_RUN=true`.

- `npm run migration:show` — estado
- `npm run migration:run` — aplicar pendientes
- `npm run migration:revert` — deshacer la última

En producción usa `DB_SYNC=false` y aplica los cambios con `migration:run`.

## Despliegue en producción (VPS)

La vía soportada es un VPS con Docker Compose + Traefik + Let's Encrypt,
probada sobre **Contabo con Ubuntu 24.04 LTS**. La guía paso a paso está en
[DEPLOY_VPS.md](DEPLOY_VPS.md).

Resumen:

```bash
# 1) En el VPS, como root: instala Docker, ufw, fail2ban, swap y el usuario 'deploy'
sudo bash scripts/vps-bootstrap.sh deploy

# 2) Como 'deploy', configura los secretos
cp .env.prod.example .env && nano .env && chmod 600 .env

# 3) Despliega (build + up + espera a healthy)
bash scripts/deploy.sh

# 4) Sólo la primera vez: crea el administrador
docker compose -f docker-compose.prod.yml exec backend npm run seed:prod
```

Operación:

| Tarea | Comando |
|---|---|
| Actualizar | `bash scripts/deploy.sh` |
| Backup (base + uploads) | `bash scripts/backup-db.sh` |
| Restaurar | `bash scripts/restore-db.sh <archivo.sql.gz>` |
| Migraciones a mano | `docker compose -f docker-compose.prod.yml exec backend npm run migration:run:prod` |

## Despliegue histórico (Render + Netlify)

### Backend (Render + Neon)
- Definir `DATABASE_URL`, `DB_SSL=true`, `DB_SYNC=false` (o habilitar `true` temporalmente para sincronizar y volver a `false`).
- Definir `JWT_SECRET`, `BUSINESS_TZ`.
- El backend sirve archivos en `/uploads`.

### Frontend (Netlify)
- Build: `npm run build`
- Publish: `apps/frontend/dist`
- Variables: `VITE_API_URL` (apuntar al dominio del backend), `VITE_SOCKET_URL`, `VITE_MAPBOX_TOKEN`.

## Notas de mantenimiento
- Si no puedes eliminar usuarios por restricciones de FK, ajusta el esquema:
  - Tareas: `ON DELETE SET NULL` en `assignedToId`/`createdById` (columnas NULL).
  - Mensajes: `ON DELETE CASCADE` en `senderId`/`recipientId`.
  - Alternativa temporal: `DB_SYNC=true` y redeploy (volver a `false` después).
