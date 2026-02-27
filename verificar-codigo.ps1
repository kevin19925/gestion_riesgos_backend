# Script para verificar que el codigo este completo antes de deployment

Write-Host "Verificando codigo del backend..." -ForegroundColor Cyan
Write-Host ""

$errores = 0

# 1. Verificar archivos de rutas
Write-Host "Verificando archivos de rutas..." -ForegroundColor Yellow
$archivosRutas = @(
    "src/routes/configuracionResidual.routes.ts",
    "src/routes/index.ts"
)

foreach ($archivo in $archivosRutas) {
    if (Test-Path $archivo) {
        Write-Host "  OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 2. Verificar controladores
Write-Host ""
Write-Host "Verificando controladores..." -ForegroundColor Yellow
$archivosControladores = @(
    "src/controllers/configuracionResidual.controller.ts"
)

foreach ($archivo in $archivosControladores) {
    if (Test-Path $archivo) {
        Write-Host "  OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 3. Verificar servicios
Write-Host ""
Write-Host "Verificando servicios..." -ForegroundColor Yellow
$archivosServicios = @(
    "src/services/configuracionResidual.service.ts",
    "src/services/recalculoResidual.service.ts"
)

foreach ($archivo in $archivosServicios) {
    if (Test-Path $archivo) {
        Write-Host "  OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 4. Verificar que la ruta este registrada en index.ts
Write-Host ""
Write-Host "Verificando registro de ruta..." -ForegroundColor Yellow
$indexContent = Get-Content "src/routes/index.ts" -Raw
if ($indexContent -match "configuracionResidual") {
    Write-Host "  OK: Ruta registrada en index.ts" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Ruta NO registrada en index.ts" -ForegroundColor Red
    $errores++
}

# 5. Verificar schema de Prisma
Write-Host ""
Write-Host "Verificando schema de Prisma..." -ForegroundColor Yellow
if (Test-Path "prisma/schema.prisma") {
    $schemaContent = Get-Content "prisma/schema.prisma" -Raw
    if ($schemaContent -match "model ConfiguracionResidual") {
        Write-Host "  OK: Modelo ConfiguracionResidual existe" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Modelo ConfiguracionResidual NO encontrado" -ForegroundColor Red
        $errores++
    }
} else {
    Write-Host "  ERROR: schema.prisma NO encontrado" -ForegroundColor Red
    $errores++
}

# Resumen
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($errores -eq 0) {
    Write-Host "Verificacion completada: TODO CORRECTO" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos pasos:" -ForegroundColor Cyan
    Write-Host "  1. Hacer commit y push a Git" -ForegroundColor White
    Write-Host "  2. Conectar a Azure via SSH" -ForegroundColor White
    Write-Host "  3. Actualizar codigo con git pull" -ForegroundColor White
    Write-Host "  4. Reconstruir Docker" -ForegroundColor White
} else {
    Write-Host "Verificacion completada: $errores ERROR(ES)" -ForegroundColor Red
    Write-Host "Corrige los errores antes de deployment" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
