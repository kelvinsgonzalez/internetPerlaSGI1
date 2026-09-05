# Despliegue en VPS — InternetPerla

Guía concreta para poner el sistema en producción en un **VPS de Contabo con
Ubuntu 24.04 LTS**, usando Docker Compose + Traefik + Let's Encrypt.

Sirve igual para cualquier otro proveedor (Hetzner, DigitalOcean, Lightsail):
lo único específico de Contabo son las notas marcadas como *Contabo*.

---

## 1. Lo que necesitas antes de empezar

| Requisito | Detalle |
|---|---|
| VPS | Contabo con **Ubuntu 24.04 LTS**. Mínimo 2 vCPU / 4 GB RAM / 40 GB. El plan "VPS 1" cumple de sobra. |
| Acceso | La IP y la contraseña de root que Contabo envía por correo tras el aprovisionamiento. |
| Dominio | Uno propio, con acceso al panel DNS. Se usan dos subdominios: uno para la app y otro para el API. |
| Correo | Para los avisos de Let's Encrypt. |
| Token de Mapbox | Público (`pk.*`), sólo si quieres el mapa de colaboradores. |

Decisiones ya tomadas en esta configuración:

- **Postgres corre dentro del VPS**, en el propio compose. Si prefieres seguir
  con Neon, ver [§7](#7-alternativa-seguir-usando-neon).
- **Migraciones TypeORM**, no `synchronize`. El esquema se versiona.
- **Traefik** termina TLS y renueva certificados solo.

---

## 2. Preparar el servidor

### 2.1 Entrar y asegurar el acceso

*Contabo* entrega el VPS con acceso `root` por contraseña. Lo primero es
cambiar eso por una clave SSH.

Desde **tu máquina**:

```bash
ssh-keygen -t ed25519 -C "internetperla-vps"     # si aún no tienes clave
ssh-copy-id root@IP_DEL_VPS
ssh root@IP_DEL_VPS                               # ya no debe pedir contraseña
```

Ya dentro del VPS, desactiva el acceso por contraseña:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
# Contabo deja overrides que pueden reactivar la contraseña; revísalos:
grep -rE 'PasswordAuthentication|PermitRootLogin' /etc/ssh/sshd_config.d/ 2>/dev/null
systemctl restart ssh
```

> Antes de cerrar esta sesión, abre **otra terminal** y comprueba que puedes
> entrar. Si algo salió mal, la sesión actual sigue abierta para arreglarlo.

### 2.2 Bootstrap automático

El repositorio trae un script que deja el servidor listo:

```bash
apt-get update && apt-get install -y git
git clone <URL_DE_TU_REPO> /opt/internetperla
cd /opt/internetperla
sudo bash scripts/vps-bootstrap.sh deploy
```

Instala y configura Docker + Compose, `ufw` (SSH/80/443), `fail2ban`,
actualizaciones de seguridad automáticas, la zona horaria
`America/Guatemala`, 2 GB de swap y un usuario `deploy` con acceso a Docker.

> *Contabo* entrega los VPS **sin swap**. El build del frontend (Vite +
> Mapbox) consume bastante memoria y en planes de 4 GB puede fallar sin ella;
> por eso el script la crea.

> **ufw y Docker:** Docker escribe sus propias reglas en iptables y se salta
> `ufw` en los puertos que publica. Aquí sólo Traefik publica el 80 y el 443,
> que de todos modos deben estar abiertos, y Postgres no publica ninguno.
> No añadas `ports:` al servicio `db`.

Después, continúa como el usuario `deploy`:

```bash
sudo chown -R deploy:deploy /opt/internetperla
su - deploy
cd /opt/internetperla
```

---

## 3. DNS

En tu proveedor de DNS, crea dos registros **A** apuntando a la IPv4 del VPS:

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `app` | IP_DEL_VPS | 300 |
| A | `api` | IP_DEL_VPS | 300 |

Verifica antes de seguir:

```bash
dig +short app.tudominio.com
dig +short api.tudominio.com
```

Ambos deben devolver la IP del VPS. **Si no propagaron, Let's Encrypt fallará**
y Traefik quedará reintentando.

> No crees registros `AAAA` salvo que hayas configurado IPv6 en el VPS. Si el
> dominio resuelve a una IPv6 en la que nada escucha, la validación del
> certificado falla.

---

## 4. Configurar y desplegar

```bash
cp .env.prod.example .env
nano .env
chmod 600 .env
```

Rellena los dominios, el correo de ACME y genera los secretos:

```bash
openssl rand -base64 32   # -> DB_PASSWORD
openssl rand -hex 32      # -> JWT_SECRET
```

> **No reutilices** el `JWT_SECRET` ni la contraseña de base de datos que
> estuvieron commiteados en `apps/backend/.env.local`: deben considerarse
> comprometidos.

Despliega:

```bash
bash scripts/deploy.sh
```

El script valida el `.env`, respalda la base si ya existía, construye las
imágenes, levanta todo y espera a que el backend quede `healthy`.

### 4.1 Crear el primer administrador

```bash
docker compose -f docker-compose.prod.yml exec backend npm run seed:prod
```

Crea `admin@example.com` / `123456`. **Entra y cambia esa contraseña de
inmediato**, o borra el usuario tras crear el tuyo desde el panel.

### 4.2 Verificación

```bash
curl https://api.tudominio.com/api/v1/health     # -> {"status":"ok"}
curl -I https://app.tudominio.com                # -> HTTP/2 200
```

Y en el navegador: abre la app, inicia sesión, y en DevTools → Network
comprueba que la conexión a `wss://api.tudominio.com/socket.io/` se establece.

---

## 5. Operación

### 5.1 Actualizar a la última versión

```bash
cd /opt/internetperla
bash scripts/deploy.sh
```

Hace `git pull`, reconstruye y reinicia. Toma un backup automático antes de
tocar la base, y aborta si ese backup falla.

### 5.2 Migraciones

Con `DB_MIGRATIONS_RUN=true` (el valor por defecto en `.env.prod.example`) se
aplican solas al arrancar el backend. Para hacerlo a mano:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run migration:show:prod
docker compose -f docker-compose.prod.yml exec backend npm run migration:run:prod
```

> Dentro del contenedor de producción **no existe `ts-node`** (se instala con
> `--omit=dev`). Usa siempre las variantes `:prod`, que corren sobre `dist/`.

### 5.3 Backups

Manual:

```bash
bash scripts/backup-db.sh
```

Respalda la base y el volumen de archivos subidos en `~/backups/internetperla`,
con 14 días de retención, y verifica que el dump no salga vacío ni corrupto.

Diario a las 03:00, como usuario `deploy`:

```bash
crontab -e
```

```cron
0 3 * * * cd /opt/internetperla && bash scripts/backup-db.sh >> /home/deploy/backup.log 2>&1
```

> Un backup que sólo vive en el mismo VPS no te salva de perder el VPS.
> Copia `~/backups/` fuera del servidor periódicamente (`rsync`, S3, Backblaze).

Restaurar:

```bash
bash scripts/restore-db.sh ~/backups/internetperla/internetperla-20260903-030000.sql.gz
```

### 5.4 Logs y estado

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f traefik
```

Los logs están limitados a 10 MB × 5 archivos por contenedor, así que no
llenan el disco.

### 5.5 Reiniciar un servicio

```bash
docker compose -f docker-compose.prod.yml restart backend
```

---

## 6. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| El certificado no se emite | DNS sin propagar, puerto 80 cerrado, o un registro `AAAA` sin IPv6 funcional | `dig +short app.tudominio.com`, `ufw status`, borrar el `AAAA` |
| `too many certificates already issued` | Límite semanal de Let's Encrypt por repetir despliegues fallidos | Esperar, y probar primero con `--certificatesresolvers.le.acme.caserver` de staging |
| El frontend carga pero el API da error de CORS | `FRONTEND_DOMAIN` en `.env` no coincide con el dominio real | Corregir `.env` y `docker compose ... up -d backend` |
| El WebSocket no conecta | `VITE_SOCKET_URL` apunta a `http://` en vez de `https://` | Lo genera el compose desde `BACKEND_DOMAIN`; reconstruir el frontend |
| Cambié una `VITE_*` y no se aplica | Se hornean en el bundle durante el build, no en runtime | `docker compose -f docker-compose.prod.yml build frontend && ... up -d frontend` |
| `DB connection refused` al arrancar | El backend arrancó antes que Postgres | Ya hay `depends_on: service_healthy`; revisar `logs db` |
| El build del frontend muere sin mensaje | Sin memoria (VPS de 4 GB sin swap) | `swapon --show`; si está vacío, correr `vps-bootstrap.sh` otra vez |
| `permission denied` al usar docker | El usuario acaba de entrar al grupo `docker` | Cerrar sesión y volver a entrar |
| Disco lleno | Imágenes viejas acumuladas | `docker system prune -af` |

---

## 7. Alternativa: seguir usando Neon

Si prefieres no alojar Postgres en el VPS:

1. En `.env`, añade `DATABASE_URL=postgresql://...` y `DB_SSL=true`.
2. Comenta el servicio `db` y su `depends_on` en `docker-compose.prod.yml`.

`AppModule` da prioridad a `DATABASE_URL` sobre las variables `DB_*`, así que
no hace falta tocar código.

**Para migrar de Neon al VPS**, en cambio:

```bash
# En tu máquina, con la DATABASE_URL de Neon
pg_dump "postgresql://..." --clean --if-exists | gzip > neon.sql.gz
scp neon.sql.gz deploy@IP_DEL_VPS:/opt/internetperla/
# En el VPS
bash scripts/restore-db.sh /opt/internetperla/neon.sql.gz
```

---

## 8. Qué corre en el VPS y qué no

Todo el sistema vive en el propio servidor. Nada de la aplicación depende de un
servicio gestionado por terceros:

| Componente | Dónde corre | Estado externo |
|---|---|---|
| Base de datos | Contenedor `db` (postgres:17-alpine), volumen `ip_db_data` en el VPS | Ninguno |
| Backend | Contenedor `backend`, imagen construida en el VPS | Ninguno: no hace **ninguna** llamada saliente |
| Frontend | Contenedor `frontend` (nginx), bundle compilado en el VPS | Ninguno para cargar la app |
| Archivos subidos | Volumen `uploads` en el VPS | Ninguno |
| TLS | Traefik en el VPS | Let's Encrypt sólo al emitir/renovar el certificado |

Lo único que el **navegador** pide fuera del VPS es **Mapbox**
(`api.mapbox.com` para los mapas, `events.mapbox.com` para su telemetría), y
sólo al abrir la página *Mapa de ubicación*. Es inherente a usar Mapbox: no se
puede quitar sin renunciar al mapa o montar un servidor de teselas propio. El
resto de la app funciona con normalidad aunque Mapbox sea inalcanzable.

La tipografía Montserrat **está autoalojada** (`@fontsource/montserrat`): antes
se pedía a `fonts.googleapis.com` y `fonts.gstatic.com` en cada carga, y ya no.

Docker Hub y npm sólo intervienen **al construir**, no en tiempo de ejecución.

Para comprobarlo tú mismo tras un despliegue, abre DevTools → Network, filtra
por dominio y confirma que sólo aparecen tus dos subdominios (y `api.mapbox.com`
si entras al mapa).

---

## 9. Estado del hardening

Ya aplicado en el repositorio:

- [x] CORS por variable de entorno (`CORS_ORIGINS`), compartido entre el API y Socket.IO.
- [x] Migraciones TypeORM con `DB_SYNC=false` en producción.
- [x] `.dockerignore` en ambas apps: `node_modules`, `dist` y los `.env` locales ya no entran a la imagen.
- [x] Healthchecks de Postgres y del backend; el despliegue falla si el backend no levanta.
- [x] Límites de log por contenedor.
- [x] Cabeceras de seguridad (HSTS, nosniff, referrer-policy) vía middleware de Traefik.
- [x] Postgres sin puertos publicados, sólo en la red interna del compose.
- [x] La subida de archivos acepta sólo imágenes, con límite de 10 MB.
- [x] Scripts de backup verificado y restauración.

Pendiente, en orden de valor:

1. **Rotar las credenciales comprometidas** — la contraseña de Neon, el `JWT_SECRET`
   y el token de Mapbox estuvieron en `apps/backend/.env.local`, versionado desde el
   commit inicial. Sacarlo del índice no lo borra del historial: hace falta rotar, y
   opcionalmente limpiar con `git filter-repo`.
2. Copiar los backups fuera del VPS.
3. Rate limiting en el backend (`@nestjs/throttler`) o vía middleware de Traefik.
4. Monitoreo de uptime (Uptime Kuma cabe en el mismo VPS).
5. Actualizar dependencias con vulnerabilidades que exigen saltos mayores
   (NestJS 12, Vite 8, react-router 7).
6. Cloudflare por delante para DDoS y caché.
