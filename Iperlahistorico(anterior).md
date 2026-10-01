# Historial de Cobros — Iperla · Documento técnico

Visión general del proyecto para quien vaya a mantenerlo o extenderlo. Complementa al
[README.md](README.md), que cubre instalación, uso y despliegue.

---

## 1. Qué es

Aplicación web interna para consultar y registrar los **cobros mensuales** de los clientes de
Iperla. Permite:

- Buscar un cliente y ver su ficha con el historial de pagos.
- Registrar pagos uno a uno o importarlos en lote desde CSV/JSON, con detección de duplicados.
- Filtrar todos los pagos por fechas, cliente y cobrador, y exportar el resultado a CSV.
- Imprimir o guardar en PDF la ficha de un cliente.
- Crear usuarios con acceso al sistema.

Montos en quetzales (`Q`, formato `es-GT`).

---

## 2. Stack

| Capa | Tecnología |
|------|------------|
| Servidor | Node.js ≥ 22.5, módulo nativo `http` (sin Express) |
| Base de datos | SQLite vía `node:sqlite` (`DatabaseSync`), modo WAL |
| Autenticación | Contraseñas con `scrypt` + salt; sesiones en memoria con cookie `sid` |
| Frontend | HTML + CSS + JavaScript vanilla, una sola página (SPA) |
| Contenedor | `node:24-alpine`, Docker Compose con volumen persistente |

**Cero dependencias**: no hay `node_modules`, ni build, ni lockfile.

---

## 3. Arquitectura

```
 Navegador (public/)                       server.js                        db.js
┌────────────────────┐   fetch /api/*   ┌───────────────────────┐      ┌──────────────────┐
│ index.html         │ ───────────────► │ Router manual por      │ ───► │ DatabaseSync      │
│ app.js  (lógica)   │ ◄─────────────── │ pathname + método      │ ◄─── │ historial_cobros  │
│ styles.css         │      JSON        │ Sesiones: Map en RAM   │      │ .db (WAL)         │
└────────────────────┘                  │ Estáticos + fallback   │      └──────────────────┘
                                        │ SPA a index.html       │
                                        └───────────────────────┘
```

- **`server.js`**: un único `http.createServer` con un bloque `if` por cada ruta. Todo lo que
  empieza con `/api/` es la API; el resto se sirve desde `public/`, y si el archivo no existe
  devuelve `index.html`.
- **`db.js`**: abre la base, crea el esquema (`init()` al cargarse), siembra el usuario
  `admin` y 4 registros de ejemplo si las tablas están vacías (`seed()`), y exporta
  `hashPassword` / `verifyPassword`.
- **`public/app.js`**: maneja pantallas (`#screen-login`, `#screen-search`, `#screen-ficha`)
  y modales (`#modal-pago`, `#modal-acciones`, `#modal-registros`, `#modal-filtro`,
  `#modal-usuario`) mostrando u ocultando con la clase `hidden`.

---

## 4. Modelo de datos

Dos tablas. **No hay tabla de clientes**: un cliente es el conjunto de filas de
`recaudacion` que comparten exactamente el mismo texto en `cliente`.

### `recaudacion` — una fila por pago

| Columna | Tipo | Origen (columna del archivo) |
|---------|------|------------------------------|
| `row_id` | INTEGER PK | interno de la app |
| `ext_id` | INTEGER | A · `Id` |
| `cliente` | TEXT NOT NULL | B · `Cliente` |
| `ubicacion` | TEXT | C · `Ubicación` |
| `concepto` | TEXT | D · `Concepto` |
| `fecha` | TEXT | E · `Fecha` (`d/m/aaaa h:mm:ss`) |
| `meses_cancelados` | TEXT | F · `Meses_Cancelados` (ej. "Abril Mayo") |
| `cantidad_meses` | INTEGER | G · `Cantidad_Meses_pagados` |
| `total` | REAL | H · `Total` |
| `comentarios` | TEXT | I · `Comentarios` (en la UI se muestra como "Forma de pago") |
| `cobrador` | TEXT | J · `Cobrador` |
| `codigo` | TEXT | K · `Codigo` |

Índices: `cliente`, `fecha`, `cobrador`, `ext_id`.

### `usuarios`

`id`, `usuario` (UNIQUE), `password` (`salt:hash` en hex), `nombre`.

> `init()` borra las tablas `pagos` y `clientes` si existen: son restos de un modelo anterior.

---

## 5. Lógica clave

### Fechas
Se guardan como **texto** con el formato del archivo de origen (`1/10/2022 16:41:31`), así que
no se pueden ordenar ni comparar directamente en SQL. El servidor usa dos funciones:

- `toISO(f)` → `aaaa-mm-dd`, para comparar contra los filtros `desde` / `hasta`.
- `fechaKey(f)` → `aaaa-mm-dd hh:mm:ss`, para ordenar.

Por eso los filtros de fecha se aplican **en JavaScript** después de leer las filas, no en el
`WHERE`. Las filas con una fecha que no se puede interpretar **siempre pasan** el filtro.

Orden actual:
- **Ficha del cliente** (`/api/cliente`): de la más antigua a la más reciente. El "Último
  pago" es la última fila, y su detalle completo se muestra en la tarjeta superior.
- **Filtro global** (`/api/pagos`): de la más reciente a la más antigua.

En el formulario de pago, el `datetime-local` del navegador se convierte a
`d/m/aaaa hh:mm:00` con `fromDatetimeLocal()` antes de enviarse.

### Búsqueda de clientes
`/api/clientes` agrupa con `GROUP BY cliente`, trae **todos** los grupos y filtra en JS con
`norm()` (sin acentos, minúsculas) por nombre o ubicación. Devuelve como máximo 300.

### Importación y duplicados
Flujo en dos llamadas al mismo endpoint `/api/registros/import`:

1. El navegador lee el archivo (`parseJSON` o `parseCSVtoObjs`) y envía las filas con
   `preview: true`. El servidor normaliza los encabezados con `normKey()` y marca cada fila
   como `invalido` (sin cliente) o `duplicado`.
2. El usuario decide qué omitir y se envía de nuevo sin `preview`, con `omitir: [índices]`.
   Todo se inserta en una sola transacción (`BEGIN` / `COMMIT` / `ROLLBACK`).

Criterio de duplicado:
- Si la fila trae `Id` → existe otra con el mismo `ext_id`.
- Si no → coincide `cliente + fecha + codigo + total`.

El cuerpo de las peticiones está limitado a ~5 MB (`readBody`).

### Sesiones
`crypto.randomUUID()` como `sid`, guardado en un `Map` en memoria. La cookie dura 8 h
(`Max-Age=28800`), pero el servidor no guarda vencimiento: la sesión vive hasta el logout o el
reinicio del proceso.

---

## 6. API (resumen)

| Método | Ruta | Auth | Notas |
|--------|------|------|-------|
| POST | `/api/login` | — | `{usuario, password}` → cookie `sid` |
| POST | `/api/logout` | — | Borra la sesión |
| GET | `/api/me` | — | `{autenticado, nombre}` |
| GET | `/api/clientes?q=` | ✔ | Máx. 300, con `num` y `total` por cliente |
| GET | `/api/cliente?nombre=&desde=&hasta=` | ✔ | `{cliente, registros, resumen{num,total,ultimo,ultimoRegistro}}` |
| POST | `/api/registros` | ✔ | Crea un pago; `cliente` obligatorio |
| POST | `/api/registros/import` | ✔ | `{registros, preview?, omitir?}` |
| GET | `/api/cobradores` | ✔ | Lista de cobradores distintos |
| GET | `/api/pagos?desde=&hasta=&cliente=&cobrador=` | ✔ | `{pagos, resumen{num_pagos,total}}` |
| POST | `/api/usuarios` | ✔ | Contraseña de 6 caracteres como mínimo |

Fechas de los filtros en formato `aaaa-mm-dd`.

---

## 7. Estructura de archivos

```
IPERLAHISTORICO/
├── server.js            Servidor HTTP, API y estáticos
├── db.js                Esquema, seed y hashing (también `npm run seed`)
├── package.json         Scripts start / seed, engines node >= 22.5
├── Dockerfile           node:24-alpine, usuario node, DB en /data
├── docker-compose.yml   Servicio "app", puerto 3000, volumen historial-data
├── public/
│   ├── index.html       Pantallas, modales y plantilla de impresión
│   ├── app.js           Lógica del frontend
│   └── styles.css       Estilos (incluye @media print)
├── README.md            Instalación, uso y despliegue
└── PROYECTO.md          Este documento
```

`historial_cobros.db` (y sus `-wal` / `-shm`) se generan al arrancar y están en `.gitignore`.

---

## 8. Correr el proyecto

```bash
npm start                 # http://localhost:3000
PORT=3002 npm start       # en otro puerto
docker compose up -d --build
```

Usuario inicial: `admin` / `admin123`.

> **Nota de este equipo:** el puerto 3000 lo ocupa el contenedor `iperla-historial-cobros`,
> que se levanta desde otra copia del proyecto
> (`~/IperlaProyectos/GestorFinanciero/HistorialFinanciero/iperla-historial-cobros`) con su
> propio volumen de datos. Para trabajar con este repo, usa otro puerto
> (`PORT=3002 npm start`) o detén ese contenedor antes de `docker compose up`.

---

## 9. Problemas y diferencias detectados en el código

| # | Dónde | Qué pasa |
|---|-------|----------|
| 1 | `public/app.js` · `parseCSV` | Trata **`,` y `;` a la vez** como separadores. En un CSV separado por `;`, un valor sin comillas como `Zona 5, Guatemala` se parte en dos columnas y desplaza todas las siguientes. |
| 2 | `README.md` §3 | Dice que la ficha se ordena "de más reciente a más antiguo". Desde el commit `f1ec5b0` se ordena de más antiguo a más reciente. |
| 3 | `public/index.html` (modal de importación) | Dice que los registros "se asocian a los clientes por su **código**", pero se agrupan por el **nombre** exacto del campo `cliente`. |
| 4 | Impresión (`#btn-print`) | El campo "Código" del encabezado muestra el `ext_id` del primer registro, no el campo `codigo`. |
| 5 | Modelo de clientes | Un nombre escrito distinto ("Maria" / "María", espacios extra) se ve como dos clientes diferentes. |
| 6 | Rendimiento | `/api/clientes` y `/api/pagos` leen todas las filas y filtran en memoria. Funciona bien con miles de registros; con cientos de miles convendría guardar la fecha en ISO y filtrar en SQL. |
| 7 | Sesiones | El `Map` nunca se purga; las sesiones abandonadas se acumulan hasta reiniciar el proceso. |

Las limitaciones de seguridad (cookie sin `Secure`, sin roles, sin rate limiting en el login,
credenciales por defecto) ya están listadas en el README §8.

---

## 10. Historial

| Commit | Cambio |
|--------|--------|
| `b38d9fc` | App inicial |
| `f1ec5b0` | Orientación de las fechas: la ficha pasa a orden ascendente; la tarjeta "Último pago" muestra el detalle completo del último pago; la ubicación se movió junto al nombre |
