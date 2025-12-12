# InternetPerla (Monorepo)

Sistema de administración + app web para gestión de colaboradores, inventario, tareas y finanzas.

- Backend: NestJS + TypeORM + PostgreSQL + JWT (roles `ADMIN`/`USER`).
- Frontend: React + Vite + TypeScript + Tailwind.
- Realtime: Socket.IO.

Aplicación web (producción)
- https://iperla.netlify.app/login

## Estructura
- `apps/backend` — API REST + WebSockets
- `apps/frontend` — SPA (Vite)
- `docker-compose.yml` — orquesta DB + backend + frontend

## Requisitos
- Node.js 18+ (recomendado 20)
- Docker (opcional para levantar todo con compose)

## Arranque rápido con Docker
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

## Credenciales de ejemplo (seed)
- `admin@example.com` / `123456` (ADMIN)
- `user@example.com` / `123456` (USER)

Usuarios de demostración (producción)
“Si desea ingresar como administrador, conéctese a la base de datos y cambie manualmente el rol del usuario.”
- Sadie González — `sadie@gmail.com` / `sadie123`
- Yair Villatoro — `yair@gmail.com` / `yair123`
- Kelvin Sadie — `kelvin@gmail.com` / `kelvin123`
- Josué Morales — `josue@gmail.com` / `josue123`
Nota: estas cuentas existen en la base de datos de producción; si se cambian/borran, las credenciales pueden dejar de funcionar.

## Despliegue sugerido

### Backend (Render + Neon)
- Definir `DATABASE_URL`, `DB_SSL=true`, `DB_SYNC=false` (o habilitar `true` temporalmente para sincronizar y volver a `false`).
- Definir `JWT_SECRET`, `BUSINESS_TZ`.
- El backend sirve archivos en `/uploads`.

### Frontend (Netlify)
- Build: `npm run build`
- Publish: `apps/frontend/dist`
- Variables: `VITE_API_URL` (apuntar al dominio del backend), `VITE_SOCKET_URL`, `VITE_MAPBOX_TOKEN`.

### Checklist Netlify / Render / Neon
- Netlify: `VITE_API_URL` debe incluir `/api/v1` (ej. `https://tu-backend.onrender.com/api/v1`), `VITE_SOCKET_URL` es el origen del backend (sin `/api/v1`); redeploy para que Vite tome las env.
- Render: `JWT_SECRET` fijo (no rotar entre despliegues), `JWT_EXPIRES_IN` opcional, `DATABASE_URL` de Neon con `sslmode=require`; redeploy tras cambios.
- Neon: validar conexión (`DATABASE_URL`) y que exista al menos un usuario ADMIN; cambiar `JWT_SECRET` invalida tokens, los usuarios deben volver a iniciar sesión.
- Navegador: si se cambia `JWT_SECRET`, limpiar `localStorage` (`ip_token`) o volver a autenticarse.

## Notas de mantenimiento
- Si no puedes eliminar usuarios por restricciones de FK, ajusta el esquema:
  - Tareas: `ON DELETE SET NULL` en `assignedToId`/`createdById` (columnas NULL).
  - Mensajes: `ON DELETE CASCADE` en `senderId`/`recipientId`.
  - Alternativa temporal: `DB_SYNC=true` y redeploy (volver a `false` después).
