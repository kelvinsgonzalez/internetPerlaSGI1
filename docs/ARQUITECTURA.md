# Arquitectura del Proyecto InternetPerla 2.0

Este documento resume la arquitectura, módulos, modelos de datos, endpoints y flujo de ejecución del monorepo.

## Visión general

- Monorepo con `apps/backend` (NestJS + TypeORM + PostgreSQL + JWT) y `apps/frontend` (React + Vite + Tailwind).
- Orquestación con Docker: `db` (Postgres 15), `backend` (puerto 3000), `frontend` (puerto 5173 expuesto como 3001 en compose).
- Prefijo API: `/api/v1`.
- Auth JWT con roles `ADMIN` y `USER`.
- Realtime con Socket.IO autenticado por JWT (rooms por usuario y sala `role:ADMIN`).

## Backend (NestJS)

- Entrypoint: `src/main.ts`
  - CORS habilitado, `app.setGlobalPrefix('api/v1')`, ValidationPipe global.
- `AppModule`: carga `ConfigModule`, `ServeStaticModule` para `/uploads`, y `TypeOrmModule.forRootAsync` con `synchronize` configurable por `DB_SYNC`.
- Módulos principales:
  - `auth`: login/register, JWT strategy. Login auto-registra asistencia IN para usuarios normales si no existe en el día.
  - `users`: entidad `User { id, email, passwordHash, role, name }`.
  - `customers`: CRUD simple `Customer { id, name, email, phone? }`.
  - `attendance`: `AttendanceRecord { id, name, tipo(IN|OUT), timestamp, note? }`.
  - `inventory`: Items, Warehouses, Stocks y Movements (IN/OUT) vía repos dedicados.
  - `finance`: Periodos de planilla, ítems, préstamos y deudas internas.
  - `messages` y `tasks`: módulos listados para UI.
  - `realtime`: gateway WebSocket que valida JWT y segmenta por rooms.
- Capa de Repositorios (`src/repositories`): Injectable wrappers de `Repository<T>` para aislamiento y testing; autoLoadEntities=true.

### Finanzas

Entidades y DTOs:

- `PayrollPeriod { id, startDate(date), endDate(date), status(OPEN|CLOSED) }`.
- `PayrollItem { id, period(M:1), type(SALARY|BONUS|DEDUCTION), amount(decimal), employeeName }`.
- `Loan { id, employeeName, total(decimal), installments(int), balance(decimal) }`.
- `InternalDebt { id, employeeName, description(text), amount(decimal), balance(decimal) }`.

Rutas (todas protegidas por JWT; operaciones de escritura restringidas a ADMIN):

- `GET /finance/periods`, `POST /finance/periods`, `PATCH /finance/periods/:id/status`.
- `GET /finance/payroll-items`, `POST /finance/payroll-items`.
- `GET /finance/loans`, `POST /finance/loans`, `PATCH /finance/loans/:id/balance`.
- `GET /finance/debts`, `POST /finance/debts`, `PATCH /finance/debts/:id/balance`.
- `CashEntry { id, entryDate(date), type(INCOME|EXPENSE), description, amount(decimal), createdAt, createdBy? }`.

Corte de caja (disponible para ADMIN y USER):

- `GET /finance/cash-cut?date=YYYY-MM-DD` -> Totales e ítems del día.
- `POST /finance/cash-entry` body: `{ entryDate, type: 'INCOME'|'EXPENSE', description, amount }`.

### Autenticación

- `POST /auth/register` -> crea usuario (por defecto USER, el seed/primer usuario puede ser ADMIN).
- `POST /auth/login` -> devuelve `{ access_token, user }` con payload `{ sub, email, role, name }`.
- Estrategia JWT en header `Authorization: Bearer <token>`.

### Healthcheck

- `GET /health` -> `{ status: 'ok' }`.

## Frontend (React + Vite)

- Entrada `src/main.tsx` con `BrowserRouter`, `Toaster` y estilos Tailwind.
- Router en `pages/App.tsx` con `Protected` guard y switching por rol para panel Admin vs Dashboard usuario.
- Auth Context `hooks/useAuth.tsx`:
  - Persiste `ip_token` en localStorage; decodifica payload para `user`.
  - `login`/`register` usan `services/api.ts`; inyecta header Authorization.
- API client `services/api.ts`:
  - baseURL = `VITE_API_URL` o fallback `http(s)://<host>:3000/api/v1`.
  - `getApiOrigin()` para Socket.IO origin.
- Socket Hook `hooks/useSocket.ts`: conecta a `io(getApiOrigin(), { auth: { token }})` cuando hay sesión.
- Páginas principales: Login, Register, Dashboard, AdminPanel, Customers, Inventory, Attendance, Finance, Messages, TasksAdmin, MyTasks, Profile, Workers.
- Componentes reutilizables: `components/ip/{LoadingState, ErrorState, EmptyState}` y `components/ui/*`.

## Docker Compose

- `db`: variables POSTGRES\_\* con defaults.
- `backend`: variables PORT=3000, DB\_\* referenciando `db`, `DB_SYNC` default `true`, `JWT_SECRET`/`EXPIRES_IN` con defaults. Volumen `uploads`.
- `frontend`: `VITE_API_URL=http://localhost:3000/api/v1`, expuesto en host `3001:5173`.

## Convenciones y Notas

- Prefijo de rutas en backend `/api/v1`; en frontend se usa `api.get('/...')` sin volver a anteponer el prefijo.
- Validación con class-validator en DTOs; pipes con `whitelist` y `transform` activos.
- Entities usan `decimal` para montos; considerar convertir a number en el cliente.
- Roles: ADMIN controla módulos sensibles (inventario, finanzas, usuarios). USER usa dashboard y mensajería.

## Flujo de Autenticación y Realtime

1. Usuario se loguea -> recibe JWT.
2. Frontend guarda `ip_token` y configura Axios; hook `useSocket` abre conexión WS con `auth.token`.
3. Gateway verifica JWT y asocia socket a rooms por usuario y por rol.

## Próximos pasos sugeridos

- Tests unitarios para servicios y repositorios.
- Manejo estricto de decimales (usar string en API o librería decimal.js) para evitar redondeos.
- Agregar paginación/búsqueda en listados de clientes e inventario.
- Emisiones realtime en eventos clave (nuevo cliente, movimiento de inventario, etc.).
- Hardening: `DB_SYNC=false` en producción y migraciones TypeORM.
