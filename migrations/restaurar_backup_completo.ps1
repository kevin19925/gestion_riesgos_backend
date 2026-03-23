# Script para Restaurar Backup Completo y Extraer Controles
# Este script restaura el backup ANTES de la migración y extrae los controles reales

$ErrorActionPreference = "Stop"

Write-Host "=== Restauración de Backup Completo (Pre-Migración) ===" -ForegroundColor Cyan
Write-Host ""

# Configuración
$PGHOST = "localhost"
$PGUSER = "postgres"
Write-Host "Ingrese la contraseña de PostgreSQL:" -ForegroundColor Yellow
$PGPASSWORD = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PGPASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$env:PGPASSWORD = $PlainPassword

$TEMP_DB = "temp_backup_pre_migracion"
$BACKUP_FILE = "gestion_riesgos_backend/migrations/riesgosdb_antes_migracion"
$CURRENT_DB = "riesgos_db"

# Verificar que existe el archivo de backup
if (-not (Test-Path $BACKUP_FILE)) {
    Write-Host "❌ ERROR: No se encuentra el archivo de backup en:" -ForegroundColor Red
    Write-Host "   $BACKUP_FILE" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, coloca el archivo .backup en esa ubicación" -ForegroundColor Yellow
    Write-Host "o actualiza la variable BACKUP_FILE en este script" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Archivo de backup encontrado" -ForegroundColor Green
Write-Host ""

Write-Host "Paso 1: Eliminando base de datos temporal si existe..." -ForegroundColor Yellow
dropdb -h $PGHOST -U $PGUSER --if-exists $TEMP_DB 2>$null

Write-Host "Paso 2: Creando base de datos temporal..." -ForegroundColor Yellow
createdb -h $PGHOST -U $PGUSER $TEMP_DB

Write-Host "Paso 3: Restaurando backup completo (esto puede tardar unos minutos)..." -ForegroundColor Yellow
pg_restore -h $PGHOST -U $PGUSER -d $TEMP_DB -v $BACKUP_FILE 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    Write-Host "⚠️  Advertencia: Algunos errores durante la restauración (normal si hay dependencias)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Backup restaurado exitosamente" -ForegroundColor Green
}

Write-Host ""
Write-Host "Paso 4: Verificando estructura del backup..." -ForegroundColor Yellow
Write-Host ""

# Verificar estructura de CausaRiesgo
$query1 = @"
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;
"@

Write-Host "Columnas de CausaRiesgo en el backup:" -ForegroundColor Cyan
psql -h $PGHOST -U $PGUSER -d $TEMP_DB -c $query1

# Contar causas con datos de control
$query2 = @"
SELECT 
    COUNT(*) as total_causas,
    COUNT(CASE WHEN \"puntajeTotal\" IS NOT NULL THEN 1 END) as con_puntaje_total,
    COUNT(CASE WHEN \"evaluacionDefinitiva\" IS NOT NULL THEN 1 END) as con_evaluacion,
    COUNT(CASE WHEN \"controlDescripcion\" IS NOT NULL THEN 1 END) as con_descripcion,
    COUNT(CASE WHEN aplicabilidad IS NOT NULL THEN 1 END) as con_aplicabilidad
FROM \"CausaRiesgo\";
"@

Write-Host ""
Write-Host "Estadísticas de controles en el backup:" -ForegroundColor Cyan
psql -h $PGHOST -U $PGUSER -d $TEMP_DB -c $query2

# Ver ejemplos de causas con control
$query3 = @"
SELECT 
    id,
    LEFT(descripcion, 50) as descripcion,
    \"puntajeTotal\",
    \"evaluacionDefinitiva\",
    \"controlTipo\",
    aplicabilidad,
    cobertura
FROM \"CausaRiesgo\"
WHERE \"puntajeTotal\" IS NOT NULL
LIMIT 5;
"@

Write-Host ""
Write-Host "Ejemplos de causas con control:" -ForegroundColor Cyan
psql -h $PGHOST -U $PGUSER -d $TEMP_DB -c $query3

Write-Host ""
Write-Host "=== Siguiente Paso ===" -ForegroundColor Green
Write-Host ""
Write-Host "El backup ha sido restaurado en la base de datos temporal: $TEMP_DB" -ForegroundColor White
Write-Host ""
Write-Host "Ahora ejecuta el siguiente script SQL en pgAdmin:" -ForegroundColor Yellow
Write-Host "  gestion_riesgos_backend/migrations/migrar_controles_desde_backup_completo.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script:" -ForegroundColor White
Write-Host "  1. Conectará a ambas bases de datos (temp y actual)" -ForegroundColor White
Write-Host "  2. Extraerá los controles del backup" -ForegroundColor White
Write-Host "  3. Los insertará en la tabla ControlRiesgo actual" -ForegroundColor White
Write-Host ""

# Limpiar variable de entorno
$env:PGPASSWORD = ""
