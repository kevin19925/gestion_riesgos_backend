# Script PowerShell para redesplegar el backend en Azure (si usas Windows Server)
# Uso: .\deploy-azure.ps1

Write-Host "🚀 Iniciando deployment del backend en Azure..." -ForegroundColor Green

# 1. Detener el contenedor actual
Write-Host "⏹️  Deteniendo contenedor actual..." -ForegroundColor Yellow
docker compose down

# 2. Limpiar imágenes antiguas
Write-Host "🧹 Limpiando imágenes antiguas..." -ForegroundColor Yellow
docker system prune -f

# 3. Reconstruir la imagen sin caché
Write-Host "🔨 Reconstruyendo imagen Docker..." -ForegroundColor Yellow
docker compose build --no-cache

# 4. Iniciar el contenedor
Write-Host "▶️  Iniciando contenedor..." -ForegroundColor Yellow
docker compose up -d

# 5. Esperar unos segundos
Write-Host "⏳ Esperando que el servicio inicie..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 6. Verificar estado
Write-Host "✅ Verificando estado del contenedor..." -ForegroundColor Green
docker ps | Select-String "gestion-riesgos-backend"

# 7. Mostrar logs
Write-Host "📋 Últimos logs del contenedor:" -ForegroundColor Cyan
docker compose logs --tail=50

# 8. Probar la API
Write-Host "🧪 Probando endpoint de salud..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/health" -Method Get
    Write-Host "Respuesta: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "Error al probar la API: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✨ Deployment completado!" -ForegroundColor Green
Write-Host "📝 Para ver logs en tiempo real: docker compose logs -f" -ForegroundColor Cyan
Write-Host "🔍 Para verificar configuración residual: curl http://localhost:8080/api/configuracion-residual" -ForegroundColor Cyan
