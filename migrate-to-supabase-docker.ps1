# Script para migrar a Supabase usando Docker
# Ejecutar después de completar las credenciales en .env.supabase

Write-Host "🚀 Iniciando migración a Supabase..." -ForegroundColor Green

# Verificar archivo de configuración
if (-not (Test-Path ".env.supabase")) {
    Write-Host "❌ Error: No se encontró .env.supabase" -ForegroundColor Red
    exit 1
}

# Obtener credenciales desde el archivo
$envVars = @{}
Get-Content ".env.supabase" | ForEach-Object {
    if ($_ -match "^([^#].*)=(.*)$") {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# Verificar credenciales críticas
$requiredVars = @("SUPABASE_DB_HOST", "SUPABASE_DB_PASSWORD", "SUPABASE_DB_USERNAME")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not $envVars[$var] -or $envVars[$var] -eq "PENDIENTE_OBTENER_DE_SUPABASE") {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "❌ Faltan las siguientes credenciales en .env.supabase:" -ForegroundColor Red
    $missingVars | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "📋 Ve a tu proyecto Supabase y obtén:" -ForegroundColor Cyan
    Write-Host "   • Settings > Database > Database password" -ForegroundColor White
    Write-Host "   • Settings > API > service_role key" -ForegroundColor White
    exit 1
}

# Construir comando de migración usando Docker
$connectionString = "postgresql://$($envVars['SUPABASE_DB_USERNAME']):$($envVars['SUPABASE_DB_PASSWORD'])@$($envVars['SUPABASE_DB_HOST']):$($envVars['SUPABASE_DB_PORT'])/$($envVars['SUPABASE_DB_NAME'])?sslmode=require"

Write-Host "🔗 Conectando a Supabase..." -ForegroundColor Blue
Write-Host "📊 Migrando estructura y datos..." -ForegroundColor Blue

try {
    # Usar psql desde el contenedor de PostgreSQL
    $migrationCmd = "docker run --rm -v `"$(pwd):/workspace`" postgres:15-alpine psql `"$connectionString`" -f /workspace/database_backup.sql"

    Write-Host "Ejecutando: $migrationCmd" -ForegroundColor Gray
    Invoke-Expression $migrationCmd

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ ¡Migración completada exitosamente!" -ForegroundColor Green

        Write-Host "🔄 Actualizando configuración de Docker..." -ForegroundColor Blue

        # Parar contenedores actuales
        docker-compose down

        # Levantar con nueva configuración (sin BD local)
        docker-compose up -d

        Write-Host ""
        Write-Host "🎉 ¡Proyecto migrado a Supabase!" -ForegroundColor Green
        Write-Host "🌐 Frontend: http://localhost:3002" -ForegroundColor Cyan
        Write-Host "🔗 Backend: http://localhost:3003" -ForegroundColor Cyan
        Write-Host "💾 Base de datos: Supabase Cloud" -ForegroundColor Cyan

    } else {
        Write-Host "❌ Error durante la migración" -ForegroundColor Red
    }

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
