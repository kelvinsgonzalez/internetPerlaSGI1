# Instrucciones para migrar a Supabase

## Paso 1: Crear proyecto en Supabase

1. Ve a https://app.supabase.com
2. Crea un nuevo proyecto
3. Anota el nombre del proyecto y la región
4. Espera a que se complete la configuración

## Paso 2: Obtener credenciales

1. En tu proyecto Supabase, ve a Settings > API
2. Copia la "Project URL"
3. Copia la "anon public" key
4. Copia la "service_role" key (mantén secreta)

## Paso 3: Obtener credenciales de la base de datos

1. Ve a Settings > Database
2. Copia el "Host"
3. Copia la "Database password" (la que configuraste al crear el proyecto)

## Paso 4: Configurar variables de entorno

1. Copia el archivo `.env.supabase.example` a `.env.supabase`
2. Rellena todos los valores con tus credenciales de Supabase
3. Ejecuta el comando de migración

## Archivos importantes:

- `database_backup.sql` - Backup completo de tu BD actual
- `.env.supabase.example` - Plantilla de configuración
- `.env.supabase` - Tu configuración real (no subir a git)

## Comandos de migración:

```bash
# 1. Configurar variables de entorno
cp .env.supabase.example .env.supabase
# Editar .env.supabase con tus datos

# 2. Migrar la base de datos
psql "postgresql://postgres:[TU-PASSWORD]@db.[TU-PROYECTO-ID].supabase.co:5432/postgres?sslmode=require" < database_backup.sql

# 3. Actualizar docker-compose
# Se actualizará automáticamente para usar Supabase
```
