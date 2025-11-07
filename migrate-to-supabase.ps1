# Script para migrar a Supabase
# Ejecutar después de configurar .env.supabase

Write-Host "🚀 Migrando base de datos a Supabase..." -ForegroundColor Green

# Verificar que existe el archivo de configuración
if (-not (Test-Path ".env.supabase")) {
    Write-Host "❌ Error: No se encontró el archivo .env.supabase" -ForegroundColor Red
    Write-Host "📝 Copia .env.supabase.example a .env.supabase y configura tus credenciales" -ForegroundColor Yellow
    exit 1
}

# Cargar variables de entorno
Get-Content ".env.supabase" | ForEach-Object {
    if ($_ -match "^([^#].*)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Construir cadena de conexión a Supabase
$connectionString = "postgresql://$($env:SUPABASE_DB_USERNAME):$($env:SUPABASE_DB_PASSWORD)@$($env:SUPABASE_DB_HOST):$($env:SUPABASE_DB_PORT)/$($env:SUPABASE_DB_NAME)?sslmode=require"

Write-Host "🔗 Conectando a Supabase..." -ForegroundColor Blue
Write-Host "📊 Importando estructura y datos..." -ForegroundColor Blue

# Ejecutar migración
try {
    & psql $connectionString -f "database_backup.sql"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migración completada exitosamente!" -ForegroundColor Green
        Write-Host "🔄 Reiniciando servicios Docker..." -ForegroundColor Blue

        # Reiniciar contenedores con nueva configuración
        docker-compose down
        docker-compose up -d

        Write-Host "🎉 ¡Migración a Supabase completada!" -ForegroundColor Green
        Write-Host "🌐 Frontend: http://localhost:3002" -ForegroundColor Cyan
        Write-Host "🔗 Backend: http://localhost:3003" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Error durante la migración" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Asegúrate de tener psql instalado y configurado" -ForegroundColor Yellow
}
