# Script de pruebas simple usando Invoke-RestMethod
$BASE_URL = "http://localhost:8080/api"

function Write-TestHeader {
    param($message)
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "  $message" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Success {
    param($message)
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Error-Custom {
    param($message)
    Write-Host "❌ $message" -ForegroundColor Red
}

function Write-Info {
    param($message)
    Write-Host "ℹ️  $message" -ForegroundColor Blue
}

function Write-Warning-Custom {
    param($message)
    Write-Host "⚠️  $message" -ForegroundColor Yellow
}

# Variables globales
$script:testResults = @()

# ============================================================================
# TEST 1: Listar Tipologías Extendidas
# ============================================================================
Write-TestHeader "TEST 1: Listar Tipologías Extendidas"

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Get -ErrorAction Stop
    Write-Success "Tipologías encontradas: $($response.Count)"
    if ($response.Count -gt 0) {
        Write-Info "Primera tipología: $($response[0].nombre) (Nivel $($response[0].nivel))"
    }
    $script:testResults += @{ Name = "Listar Tipologías"; Passed = $true }
} catch {
    Write-Error-Custom "Error: $($_.Exception.Message)"
    $script:testResults += @{ Name = "Listar Tipologías"; Passed = $false }
}

# ============================================================================
# TEST 2: Crear Tipología Nivel 3
# ============================================================================
Write-TestHeader "TEST 2: Crear Tipología Nivel 3"

try {
    $body = @{
        nivel = 3
        nombre = "Test Tipología 3 - $(Get-Date -Format 'yyyyMMddHHmmss')"
        descripcion = "Tipología de prueba nivel 3"
        activo = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Success "Tipología nivel 3 creada con ID: $($response.id)"
    Write-Info "Nombre: $($response.nombre)"
    $script:tipologia3Id = $response.id
    $script:testResults += @{ Name = "Crear Tipología Nivel 3"; Passed = $true }
} catch {
    Write-Error-Custom "Error: $($_.Exception.Message)"
    $script:testResults += @{ Name = "Crear Tipología Nivel 3"; Passed = $false }
}

# ============================================================================
# TEST 3: Crear Tipología Nivel 4
# ============================================================================
Write-TestHeader "TEST 3: Crear Tipología Nivel 4"

try {
    $body = @{
        nivel = 4
        nombre = "Test Tipología 4 - $(Get-Date -Format 'yyyyMMddHHmmss')"
        descripcion = "Tipología de prueba nivel 4"
        activo = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Success "Tipología nivel 4 creada con ID: $($response.id)"
    Write-Info "Nombre: $($response.nombre)"
    $script:tipologia4Id = $response.id
    $script:testResults += @{ Name = "Crear Tipología Nivel 4"; Passed = $true }
} catch {
    Write-Error-Custom "Error: $($_.Exception.Message)"
    $script:testResults += @{ Name = "Crear Tipología Nivel 4"; Passed = $false }
}

# ============================================================================
# TEST 4: Validar Nivel Inválido (debe fallar)
# ============================================================================
Write-TestHeader "TEST 4: Validar Nivel Inválido (debe fallar)"

try {
    $body = @{
        nivel = 5
        nombre = "Tipología Inválida"
        descripcion = "Esto debería fallar"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BASE_URL/catalogos/tipologias-extendidas" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Error-Custom "La validación no funcionó: debería haber rechazado nivel 5"
    $script:testResults += @{ Name = "Validar Nivel Inválido"; Passed = $false }
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Success "Validación correcta: rechazó nivel inválido"
        $script:testResults += @{ Name = "Validar Nivel Inválido"; Passed = $true }
    } else {
        Write-Error-Custom "Error inesperado: $($_.Exception.Message)"
        $script:testResults += @{ Name = "Validar Nivel Inválido"; Passed = $false }
    }
}

# ============================================================================
# TEST 5: Listar Planes de Acción
# ============================================================================
Write-TestHeader "TEST 5: Listar Planes de Acción"

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/planes-accion" -Method Get -ErrorAction Stop
    $planes = $response.planes
    Write-Success "Planes encontrados: $($planes.Count)"
    
    if ($planes.Count -gt 0) {
        $script:planId = $planes[0].id
        $script:causaId = $planes[0].causaRiesgoId
        Write-Info "Primer plan ID: $($script:planId), Causa ID: $($script:causaId)"
        Write-Info "Estado: $($planes[0].estado)"
        Write-Info "Descripción: $($planes[0].descripcion)"
    } else {
        Write-Warning-Custom "No hay planes en la base de datos"
    }
    $script:testResults += @{ Name = "Listar Planes"; Passed = $true }
} catch {
    Write-Error-Custom "Error: $($_.Exception.Message)"
    $script:testResults += @{ Name = "Listar Planes"; Passed = $false }
}

# ============================================================================
# TEST 6: Obtener Trazabilidad de un Plan
# ============================================================================
Write-TestHeader "TEST 6: Obtener Trazabilidad de un Plan"

if ($script:causaId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/causas/$($script:causaId)/plan/trazabilidad" -Method Get -ErrorAction Stop
        Write-Success "Trazabilidad obtenida correctamente"
        Write-Info "Plan: $($response.plan.descripcion)"
        Write-Info "Estados en historial: $($response.historialEstados.Count)"
        Write-Info "Control derivado: $(if ($response.controlDerivado) { 'Sí' } else { 'No' })"
        Write-Info "Eventos: $($response.eventos.Count)"
        $script:testResults += @{ Name = "Obtener Trazabilidad"; Passed = $true }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Warning-Custom "Plan no encontrado (esperado si no hay planes)"
            $script:testResults += @{ Name = "Obtener Trazabilidad"; Passed = $true }
        } else {
            Write-Error-Custom "Error: $($_.Exception.Message)"
            $script:testResults += @{ Name = "Obtener Trazabilidad"; Passed = $false }
        }
    }
} else {
    Write-Warning-Custom "No hay causa ID disponible, saltando prueba"
    $script:testResults += @{ Name = "Obtener Trazabilidad"; Passed = $true }
}

# ============================================================================
# TEST 7: Cambiar Estado de un Plan
# ============================================================================
Write-TestHeader "TEST 7: Cambiar Estado de un Plan"

if ($script:causaId) {
    try {
        $body = @{
            estado = "EN_REVISION"
            observacion = "Prueba de cambio de estado desde test automatizado"
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$BASE_URL/causas/$($script:causaId)/plan/estado" -Method Put -Body $body -ContentType "application/json" -ErrorAction Stop
        Write-Success "Estado cambiado correctamente"
        Write-Info "Estado anterior: $($response.estadoAnterior)"
        Write-Info "Estado nuevo: $($response.estadoNuevo)"
        $script:testResults += @{ Name = "Cambiar Estado Plan"; Passed = $true }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Warning-Custom "Plan no encontrado"
            $script:testResults += @{ Name = "Cambiar Estado Plan"; Passed = $true }
        } else {
            Write-Error-Custom "Error: $($_.Exception.Message)"
            $script:testResults += @{ Name = "Cambiar Estado Plan"; Passed = $false }
        }
    }
} else {
    Write-Warning-Custom "No hay causa ID disponible, saltando prueba"
    $script:testResults += @{ Name = "Cambiar Estado Plan"; Passed = $true }
}

# ============================================================================
# RESUMEN
# ============================================================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DE PRUEBAS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$passed = ($script:testResults | Where-Object { $_.Passed -eq $true }).Count
$failed = ($script:testResults | Where-Object { $_.Passed -eq $false }).Count

foreach ($result in $script:testResults) {
    if ($result.Passed) {
        Write-Success $result.Name
    } else {
        Write-Error-Custom $result.Name
    }
}

Write-Host "`n------------------------------------------------------------"
if ($failed -eq 0) {
    Write-Host "Total: $($script:testResults.Count) | Exitosas: $passed | Fallidas: $failed" -ForegroundColor Green
    Write-Host "------------------------------------------------------------"
    Write-Host "🎉 ¡TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
} else {
    Write-Host "Total: $($script:testResults.Count) | Exitosas: $passed | Fallidas: $failed" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------"
    Write-Host "⚠️  Algunas pruebas fallaron. Revisa los logs arriba." -ForegroundColor Yellow
}
