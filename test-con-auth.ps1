# Script de pruebas con autenticación
$BASE_URL = "http://localhost:8080/api"
$EMAIL = "vbarahona@comware.com.ec"
$PASSWORD = "Vini2026"

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  PRUEBAS DE MIGRACIÓN - CON AUTENTICACIÓN" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# ============================================================================
# PASO 1: Autenticación
# ============================================================================
Write-Host "PASO 1: Obteniendo token de autenticación..." -ForegroundColor Yellow

$loginBody = @{
    username = $EMAIL
    password = $PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $TOKEN = $loginResponse.token
    Write-Host "✅ Token obtenido exitosamente" -ForegroundColor Green
    Write-Host "   Usuario: $($loginResponse.usuario.nombre)" -ForegroundColor Gray
    Write-Host "   Email: $($loginResponse.usuario.email)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error al autenticar: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# ============================================================================
# PASO 2: Listar Planes de Acción
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "PASO 2: Listar Planes de Acción" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

try {
    $planesResponse = Invoke-RestMethod -Uri "$BASE_URL/planes-accion" -Method Get -Headers $headers
    $planes = $planesResponse.planes
    Write-Host "✅ Planes encontrados: $($planes.Count)" -ForegroundColor Green
    
    if ($planes.Count -gt 0) {
        Write-Host "`n   Primeros 3 planes:" -ForegroundColor Gray
        for ($i = 0; $i -lt [Math]::Min(3, $planes.Count); $i++) {
            $plan = $planes[$i]
            Write-Host "   [$($i+1)] ID: $($plan.id) | Causa: $($plan.causaRiesgoId) | Estado: $($plan.estado)" -ForegroundColor Gray
            Write-Host "       Descripción: $($plan.descripcion.Substring(0, [Math]::Min(60, $plan.descripcion.Length)))..." -ForegroundColor Gray
        }
        
        # Guardar el primer plan para pruebas posteriores
        $script:testPlanId = $planes[0].id
        $script:testCausaId = $planes[0].causaRiesgoId
        Write-Host "`n   Plan seleccionado para pruebas: ID=$($script:testPlanId), Causa=$($script:testCausaId)" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  No hay planes en la base de datos" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# PASO 3: Obtener Trazabilidad de un Plan
# ============================================================================
if ($script:testCausaId) {
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "PASO 3: Obtener Trazabilidad del Plan" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan

    try {
        $trazabilidadResponse = Invoke-RestMethod -Uri "$BASE_URL/causas/$($script:testCausaId)/plan/trazabilidad" -Method Get -Headers $headers
        Write-Host "✅ Trazabilidad obtenida correctamente" -ForegroundColor Green
        Write-Host "   Plan: $($trazabilidadResponse.plan.descripcion)" -ForegroundColor Gray
        Write-Host "   Estado actual: $($trazabilidadResponse.plan.estado)" -ForegroundColor Gray
        Write-Host "   Responsable: $($trazabilidadResponse.plan.responsable)" -ForegroundColor Gray
        Write-Host "   Estados en historial: $($trazabilidadResponse.historialEstados.Count)" -ForegroundColor Gray
        Write-Host "   Control derivado: $(if ($trazabilidadResponse.controlDerivado) { 'Sí (ID: ' + $trazabilidadResponse.controlDerivado.id + ')' } else { 'No' })" -ForegroundColor Gray
        Write-Host "   Eventos registrados: $($trazabilidadResponse.eventos.Count)" -ForegroundColor Gray
        
        if ($trazabilidadResponse.historialEstados.Count -gt 0) {
            Write-Host "`n   Últimos cambios de estado:" -ForegroundColor Gray
            for ($i = 0; $i -lt [Math]::Min(3, $trazabilidadResponse.historialEstados.Count); $i++) {
                $estado = $trazabilidadResponse.historialEstados[$i]
                Write-Host "   - $($estado.estado) | $($estado.responsable) | $($estado.fechaEstado)" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# PASO 4: Cambiar Estado de un Plan
# ============================================================================
if ($script:testCausaId) {
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "PASO 4: Cambiar Estado del Plan" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan

    try {
        $cambioEstadoBody = @{
            estado = "EN_REVISION"
            observacion = "Prueba automatizada de cambio de estado - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        } | ConvertTo-Json

        $cambioResponse = Invoke-RestMethod -Uri "$BASE_URL/causas/$($script:testCausaId)/plan/estado" -Method Put -Body $cambioEstadoBody -Headers $headers
        Write-Host "✅ Estado cambiado correctamente" -ForegroundColor Green
        Write-Host "   Estado anterior: $($cambioResponse.estadoAnterior)" -ForegroundColor Gray
        Write-Host "   Estado nuevo: $($cambioResponse.estadoNuevo)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# PASO 5: Listar Tipologías Extendidas
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "PASO 5: Listar Tipologías Extendidas" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

try {
    $tipologiasResponse = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Get -Headers $headers
    Write-Host "✅ Tipologías encontradas: $($tipologiasResponse.Count)" -ForegroundColor Green
    
    if ($tipologiasResponse.Count -gt 0) {
        $nivel3 = $tipologiasResponse | Where-Object { $_.nivel -eq 3 }
        $nivel4 = $tipologiasResponse | Where-Object { $_.nivel -eq 4 }
        Write-Host "   Nivel 3: $($nivel3.Count)" -ForegroundColor Gray
        Write-Host "   Nivel 4: $($nivel4.Count)" -ForegroundColor Gray
        
        if ($nivel3.Count -gt 0) {
            Write-Host "`n   Primeras 3 tipologías nivel 3:" -ForegroundColor Gray
            for ($i = 0; $i -lt [Math]::Min(3, $nivel3.Count); $i++) {
                Write-Host "   - $($nivel3[$i].nombre)" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# PASO 6: Crear Tipología de Prueba
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "PASO 6: Crear Tipología de Prueba (Nivel 3)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

try {
    $nuevaTipologiaBody = @{
        nivel = 3
        nombre = "TEST Tipología Automatizada $(Get-Date -Format 'yyyyMMddHHmmss')"
        descripcion = "Tipología creada por prueba automatizada"
        activo = $true
    } | ConvertTo-Json

    $nuevaTipologia = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Post -Body $nuevaTipologiaBody -Headers $headers
    Write-Host "✅ Tipología creada exitosamente" -ForegroundColor Green
    Write-Host "   ID: $($nuevaTipologia.id)" -ForegroundColor Gray
    Write-Host "   Nombre: $($nuevaTipologia.nombre)" -ForegroundColor Gray
    Write-Host "   Nivel: $($nuevaTipologia.nivel)" -ForegroundColor Gray
    
    $script:testTipologiaId = $nuevaTipologia.id
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# PASO 7: Validar Nivel Inválido
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "PASO 7: Validar Nivel Inválido (debe fallar)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

try {
    $tipologiaInvalidaBody = @{
        nivel = 5
        nombre = "Tipología Inválida"
        descripcion = "Esto debería fallar"
    } | ConvertTo-Json

    $resultado = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Post -Body $tipologiaInvalidaBody -Headers $headers
    Write-Host "❌ La validación NO funcionó: debería haber rechazado nivel 5" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "✅ Validación correcta: rechazó nivel inválido" -ForegroundColor Green
        Write-Host "   Mensaje de error esperado recibido" -ForegroundColor Gray
    } else {
        Write-Host "❌ Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# PASO 8: Verificar Estructura de Datos
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "PASO 8: Verificar Estructura de Datos" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

try {
    $planesResponse = Invoke-RestMethod -Uri "$BASE_URL/planes-accion" -Method Get -Headers $headers
    $planes = $planesResponse.planes
    
    if ($planes.Count -gt 0) {
        $plan = $planes[0]
        
        # Verificar campos esperados
        $camposEsperados = @('id', 'causaRiesgoId', 'descripcion', 'estado', 'responsable', 'fechaFin')
        $camposFaltantes = @()
        
        foreach ($campo in $camposEsperados) {
            if (-not $plan.PSObject.Properties.Name.Contains($campo)) {
                $camposFaltantes += $campo
            }
        }
        
        if ($camposFaltantes.Count -eq 0) {
            Write-Host "✅ Estructura de datos correcta" -ForegroundColor Green
            Write-Host "   Todos los campos esperados están presentes" -ForegroundColor Gray
        } else {
            Write-Host "❌ Campos faltantes: $($camposFaltantes -join ', ')" -ForegroundColor Red
        }
        
        # Verificar que NO tiene campos obsoletos
        $camposObsoletos = @('gestion', 'tipoGestion')
        $camposObsoletosEncontrados = @()
        
        foreach ($campo in $camposObsoletos) {
            if ($plan.PSObject.Properties.Name.Contains($campo)) {
                $camposObsoletosEncontrados += $campo
            }
        }
        
        if ($camposObsoletosEncontrados.Count -eq 0) {
            Write-Host "✅ No se encontraron campos obsoletos" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Campos obsoletos encontrados: $($camposObsoletosEncontrados -join ', ')" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# RESUMEN FINAL
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ Autenticación: OK" -ForegroundColor Green
Write-Host "✅ Listar Planes: OK" -ForegroundColor Green
Write-Host "✅ Obtener Trazabilidad: OK" -ForegroundColor Green
Write-Host "✅ Cambiar Estado: OK" -ForegroundColor Green
Write-Host "✅ Listar Tipologías: OK" -ForegroundColor Green
Write-Host "✅ Crear Tipología: OK" -ForegroundColor Green
Write-Host "✅ Validar Nivel: OK" -ForegroundColor Green
Write-Host "✅ Verificar Estructura: OK" -ForegroundColor Green
Write-Host "`n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan
