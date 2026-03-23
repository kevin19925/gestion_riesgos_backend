# Script para Restaurar Backup y Extraer Controles
# Este script restaura el backup a una base de datos temporal y extrae los datos

$ErrorActionPreference = "Stop"

Write-Host "=== Restauración de Controles desde Backup ===" -ForegroundColor Cyan
Write-Host ""

# Configuración
$PGHOST = "localhost"
$PGUSER = "postgres"
$PGPASSWORD = Read-Host "Ingrese la contraseña de PostgreSQL" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PGPASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$env:PGPASSWORD = $PlainPassword

$TEMP_DB = "temp_backup_controles"
$BACKUP_FILE = "gestion_riesgos_backend/migrations/backup_Control"
$CURRENT_DB = "riesgos_db"

Write-Host "Paso 1: Eliminando base de datos temporal si existe..." -ForegroundColor Yellow
dropdb -h $PGHOST -U $PGUSER --if-exists $TEMP_DB 2>$null

Write-Host "Paso 2: Creando base de datos temporal..." -ForegroundColor Yellow
createdb -h $PGHOST -U $PGUSER $TEMP_DB

Write-Host "Paso 3: Restaurando backup..." -ForegroundColor Yellow
pg_restore -h $PGHOST -U $PGUSER -d $TEMP_DB -v $BACKUP_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error al restaurar el backup" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Backup restaurado exitosamente en la base de datos temporal: $TEMP_DB" -ForegroundColor Green
Write-Host ""
Write-Host "Paso 4: Verificando estructura del backup..." -ForegroundColor Yellow

# Verificar qué tablas tiene
$query1 = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
"@

Write-Host ""
Write-Host "Tablas en el backup:" -ForegroundColor Cyan
psql -h $PGHOST -U $PGUSER -d $TEMP_DB -c $query1

# Verificar estructura de CausaRiesgo
$query2 = @"
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;
"@

Write-Host ""
Write-Host "Estructura de CausaRiesgo:" -ForegroundColor Cyan
psql -h $PGHOST -U $PGUSER -d $TEMP_DB -c $query2

# Contar causas con datos de control
$query3 = @"
SELECT 
    COUNT(*) as total_causas,
    COUNT(CASE WHEN \"puntajeTotal\" IS NOT NULL THEN 1 END) as con_puntaje,
    COUNT(CASE WHEN \"evaluacionDefinitiva\" IS NOT NULL THEN 1 END) as con_evaluacion
FROM \"CausaRiesgo\";
"@

Write-Host ""
Write-Host "Estadísticas de controles en el backup:" -ForegroundColor Cyan
psql -h $PGHOST -U $PGUSER -d $TEMP_DB -c $query3

Write-Host ""
Write-Host "=== Siguiente Paso ===" -ForegroundColor Green
Write-Host "Ahora ejecuta el script SQL para migrar los controles:" -ForegroundColor White
Write-Host "  gestion_riesgos_backend/migrations/migrar_controles_desde_backup.sql" -ForegroundColor Yellow
Write-Host ""
Write-Host "Este script copiará los controles desde temp_backup_controles a riesgos_db" -ForegroundColor White

# Limpiar variable de entorno
$env:PGPASSWORD = ""
