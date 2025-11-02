# Backlog de Desarrollo del Backend (Internet Perla)

Repositorio Backend: https://github.com/sebas1401/internet_perla_2.0.git (apps/backend)

Notas
- API base: /api/v1
- Seguridad: JWT con roles ADMIN y USER
- ORM: TypeORM (capa de repositorios creada en src/repositories)

## CU-001 - Autenticación
- Endpoint: POST /api/v1/auth/register
  - Descripción: Registrar usuario (por defecto USER; si es el primero, ADMIN)
  - Reglas: Validar email único; hash de contraseña; primer usuario ADMIN
  - Seguridad: Público
- Endpoint: POST /api/v1/auth/login
  - Descripción: Iniciar sesión y retornar JWT con rol y nombre
  - Reglas: Validar credenciales con bcrypt
  - Seguridad: Público

## CU-010 - Gestionar Usuarios (ADMIN)
- Endpoint: GET /api/v1/users
  - Descripción: Listar usuarios
  - Reglas: N/A
  - Seguridad: ADMIN
- Endpoint: POST /api/v1/users
  - Descripción: Crear usuario con rol
  - Reglas: Email único; hash
  - Seguridad: ADMIN
- Endpoint: PATCH /api/v1/users/:id
  - Descripción: Actualizar datos y rol
  - Reglas: Validaciones básicas
  - Seguridad: ADMIN
- Endpoint: DELETE /api/v1/users/:id
  - Descripción: Eliminar usuario
  - Reglas: N/A
  - Seguridad: ADMIN

## CU-020 - Gestionar Clientes
- Endpoint: GET /api/v1/customers
  - Descripción: Listar clientes
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/customers
  - Descripción: Crear cliente
  - Reglas: Email único
  - Seguridad: ADMIN
- Endpoint: PATCH /api/v1/customers/:id
  - Descripción: Actualizar cliente
  - Reglas: Validaciones básicas
  - Seguridad: ADMIN
- Endpoint: DELETE /api/v1/customers/:id
  - Descripción: Eliminar cliente
  - Reglas: N/A
  - Seguridad: ADMIN

## CU-030 - Asistencia
- Endpoint: GET /api/v1/attendance
  - Descripción: Listar registros de asistencia
  - Reglas: Ordenado por timestamp DESC
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/attendance/check
  - Descripción: Registrar IN/OUT (nombre + tipo + nota)
  - Reglas: Tipo debe ser IN/OUT
  - Seguridad: Autenticado

## CU-040 - Inventario
- Endpoint: GET /api/v1/inventory/items
  - Descripción: Listar items
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/inventory/items
  - Descripción: Crear item (sku, nombre, categoría, stock mínimo)
  - Reglas: SKU único
  - Seguridad: ADMIN
- Endpoint: PATCH /api/v1/inventory/items/:id
  - Descripción: Actualizar item
  - Reglas: Validaciones básicas
  - Seguridad: ADMIN
- Endpoint: DELETE /api/v1/inventory/items/:id
  - Descripción: Eliminar item
  - Reglas: No romper integridad
  - Seguridad: ADMIN
- Endpoint: GET /api/v1/inventory/warehouses
  - Descripción: Listar almacenes
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/inventory/warehouses
  - Descripción: Crear almacén
  - Reglas: Validaciones básicas
  - Seguridad: ADMIN
- Endpoint: GET /api/v1/inventory/stocks
  - Descripción: Listar existencias por item/almacén
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: GET /api/v1/inventory/movements
  - Descripción: Listar movimientos
  - Reglas: Orden DESC
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/inventory/movements
  - Descripción: Registrar movimiento IN/OUT
  - Reglas: warehouseId requerido; validar stock en OUT; actualizar stock
  - Seguridad: ADMIN

## CU-050 - Finanzas
- Endpoint: GET /api/v1/finance/periods
  - Descripción: Listar periodos de planilla
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/finance/periods
  - Descripción: Crear periodo
  - Reglas: Fechas válidas
  - Seguridad: ADMIN
- Endpoint: PATCH /api/v1/finance/periods/:id/status
  - Descripción: Cerrar/Abrir periodo
  - Reglas: Estados OPEN/CLOSED
  - Seguridad: ADMIN
- Endpoint: GET /api/v1/finance/payroll-items
  - Descripción: Listar ítems de planilla
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/finance/payroll-items
  - Descripción: Agregar ítem a periodo
  - Reglas: Periodo válido; tipo SALARY/BONUS/DEDUCTION
  - Seguridad: ADMIN
- Endpoint: GET /api/v1/finance/loans
  - Descripción: Listar préstamos
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/finance/loans
  - Descripción: Crear préstamo (saldo = total)
  - Reglas: Totales válidos
  - Seguridad: ADMIN
- Endpoint: PATCH /api/v1/finance/loans/:id/balance
  - Descripción: Actualizar saldo del préstamo
  - Reglas: Saldo >= 0
  - Seguridad: ADMIN
- Endpoint: GET /api/v1/finance/debts
  - Descripción: Listar deudas
  - Reglas: N/A
  - Seguridad: Autenticado
- Endpoint: POST /api/v1/finance/debts
  - Descripción: Crear deuda interna (saldo = monto)
  - Reglas: Monto válido
  - Seguridad: ADMIN
- Endpoint: PATCH /api/v1/finance/debts/:id/balance
  - Descripción: Actualizar saldo de deuda
  - Reglas: Saldo >= 0
  - Seguridad: ADMIN

---
Exporta este documento a PDF para la entrega final.
