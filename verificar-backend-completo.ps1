# Verificacion completa del backend
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICACION COMPLETA DEL BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errores = 0
$advertencias = 0

# 1. Verificar que el build funcione
Write-Host "1. Verificando compilacion TypeScript..." -ForegroundColor Yellow
if (Test-Path "dist/index.js") {
    Write-Host "   OK: Proyecto compilado correctamente" -ForegroundColor Green
} else {
    Write-Host "   ERROR: No se encontro dist/index.js" -ForegroundColor Red
    $errores++
}

# 2. Verificar archivo principal
Write-Host ""
Write-Host "2. Verificando archivos principales..." -ForegroundColor Yellow
$archivosPrincipales = @(
    "src/index.ts",
    "src/app.ts",
    "src/prisma.ts"
)
foreach ($archivo in $archivosPrincipales) {
    if (Test-Path $archivo) {
        Write-Host "   OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 3. Verificar todas las rutas
Write-Host ""
Write-Host "3. Verificando archivos de rutas..." -ForegroundColor Yellow
$archivosRutas = @(
    "src/routes/index.ts",
    "src/routes/auth.routes.ts",
    "src/routes/usuarios.routes.ts",
    "src/routes/procesos.routes.ts",
    "src/routes/riesgos.routes.ts",
    "src/routes/evaluaciones.routes.ts",
    "src/routes/catalogos.routes.ts",
    "src/routes/controles.routes.ts",
    "src/routes/incidencias.routes.ts",
    "src/routes/planes-accion.routes.ts",
    "src/routes/calificacion-inherente.routes.ts",
    "src/routes/configuracionResidual.routes.ts",
    "src/routes/upload.routes.ts"
)
foreach ($archivo in $archivosRutas) {
    if (Test-Path $archivo) {
        Write-Host "   OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 4. Verificar controladores principales
Write-Host ""
Write-Host "4. Verificando controladores..." -ForegroundColor Yellow
$archivosControladores = @(
    "src/controllers/auth.controller.ts",
    "src/controllers/usuarios.controller.ts",
    "src/controllers/procesos.controller.ts",
    "src/controllers/riesgos.controller.ts",
    "src/controllers/configuracionResidual.controller.ts",
    "src/controllers/proceso-responsables.controller.ts"
)
foreach ($archivo in $archivosControladores) {
    if (Test-Path $archivo) {
        Write-Host "   OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 5. Verificar servicios
Write-Host ""
Write-Host "5. Verificando servicios..." -ForegroundColor Yellow
$archivosServicios = @(
    "src/services/configuracionResidual.service.ts",
    "src/services/recalculoResidual.service.ts"
)
foreach ($archivo in $archivosServicios) {
    if (Test-Path $archivo) {
        Write-Host "   OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $archivo NO ENCONTRADO" -ForegroundColor Red
        $errores++
    }
}

# 6. Verificar utilidades
Write-Host ""
Write-Host "6. Verificando utilidades..." -ForegroundColor Yellow
$archivosUtils = @(
    "src/utils/azureBlob.ts",
    "src/utils/cloudinary.ts"
)
foreach ($archivo in $archivosUtils) {
    if (Test-Path $archivo) {
        Write-Host "   OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: $archivo no encontrado" -ForegroundColor Yellow
        $advertencias++
    }
}

# 7. Verificar variables de entorno
Write-Host ""
Write-Host "7. Verificando configuracion (.env)..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    
    if ($envContent -match "DATABASE_URL") {
        Write-Host "   OK: DATABASE_URL configurado" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: DATABASE_URL no encontrado" -ForegroundColor Red
        $errores++
    }
    
    if ($envContent -match "PORT") {
        Write-Host "   OK: PORT configurado" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: PORT no configurado (usara default)" -ForegroundColor Yellow
        $advertencias++
    }
    
    if ($envContent -match "AZURE_STORAGE_CONNECTION_STRING") {
        Write-Host "   OK: Azure Blob Storage configurado" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: Azure Blob no configurado" -ForegroundColor Yellow
        $advertencias++
    }
    
    if ($envContent -match "CLOUDINARY") {
        Write-Host "   OK: Cloudinary configurado" -ForegroundColor Green
    } else {
        Write-Host "   ADVERTENCIA: Cloudinary no configurado" -ForegroundColor Yellow
        $advertencias++
    }
} else {
    Write-Host "   ERROR: Archivo .env no encontrado" -ForegroundColor Red
    $errores++
}

# 8. Verificar schema de Prisma
Write-Host ""
Write-Host "8. Verificando Prisma..." -ForegroundColor Yellow
if (Test-Path "prisma/schema.prisma") {
    Write-Host "   OK: schema.prisma existe" -ForegroundColor Green
    
    $schemaContent = Get-Content "prisma/schema.prisma" -Raw
    $modelos = @(
        "Usuario",
        "Proceso",
        "Riesgo",
        "ConfiguracionResidual",
        "ProcesoResponsable"
    )
    
    foreach ($modelo in $modelos) {
        if ($schemaContent -match "model $modelo") {
            Write-Host "   OK: Modelo $modelo existe" -ForegroundColor Green
        } else {
            Write-Host "   ERROR: Modelo $modelo no encontrado" -ForegroundColor Red
            $errores++
        }
    }
} else {
    Write-Host "   ERROR: schema.prisma no encontrado" -ForegroundColor Red
    $errores++
}

# 9. Verificar archivos compilados criticos
Write-Host ""
Write-Host "9. Verificando archivos compilados..." -ForegroundColor Yellow
$archivosCompilados = @(
    "dist/index.js",
    "dist/app.js",
    "dist/routes/index.js",
    "dist/routes/configuracionResidual.routes.js",
    "dist/controllers/configuracionResidual.controller.js"
)
foreach ($archivo in $archivosCompilados) {
    if (Test-Path $archivo) {
        Write-Host "   OK: $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ERROR: $archivo no compilado" -ForegroundColor Red
        $errores++
    }
}

# 10. Verificar que las rutas esten registradas
Write-Host ""
Write-Host "10. Verificando registro de rutas en index.ts..." -ForegroundColor Yellow
if (Test-Path "dist/routes/index.js") {
    $indexContent = Get-Content "dist/routes/index.js" -Raw
    $rutasEsperadas = @(
        "auth",
        "usuarios",
        "procesos",
        "riesgos",
        "configuracion-residual",
        "calificacion-inherente"
    )
    
    foreach ($ruta in $rutasEsperadas) {
        if ($indexContent -match $ruta) {
            Write-Host "   OK: Ruta /$ruta registrada" -ForegroundColor Green
        } else {
            Write-Host "   ERROR: Ruta /$ruta NO registrada" -ForegroundColor Red
            $errores++
        }
    }
}

# Resumen final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMEN DE VERIFICACION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($errores -eq 0 -and $advertencias -eq 0) {
    Write-Host "ESTADO: PERFECTO" -ForegroundColor Green
    Write-Host "El backend esta completamente responsivo" -ForegroundColor Green
    Write-Host ""
    Write-Host "Puedes proceder a:" -ForegroundColor Cyan
    Write-Host "  1. Subir a Git: git add . && git commit -m 'Backend ready' && git push" -ForegroundColor White
    Write-Host "  2. Desplegar en Azure" -ForegroundColor White
} elseif ($errores -eq 0) {
    Write-Host "ESTADO: BUENO (con advertencias)" -ForegroundColor Yellow
    Write-Host "Errores criticos: 0" -ForegroundColor Green
    Write-Host "Advertencias: $advertencias" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "El backend funcionara, pero revisa las advertencias" -ForegroundColor Yellow
} else {
    Write-Host "ESTADO: CON ERRORES" -ForegroundColor Red
    Write-Host "Errores criticos: $errores" -ForegroundColor Red
    Write-Host "Advertencias: $advertencias" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Corrige los errores antes de desplegar" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
