#!/bin/bash
# Script para redesplegar el backend en Azure
# Uso: bash deploy-azure.sh

echo "🚀 Iniciando deployment del backend en Azure..."

# 1. Detener el contenedor actual
echo "⏹️  Deteniendo contenedor actual..."
docker compose down

# 2. Limpiar imágenes antiguas (opcional pero recomendado)
echo "🧹 Limpiando imágenes antiguas..."
docker system prune -f

# 3. Reconstruir la imagen sin caché
echo "🔨 Reconstruyendo imagen Docker..."
docker compose build --no-cache

# 4. Iniciar el contenedor
echo "▶️  Iniciando contenedor..."
docker compose up -d

# 5. Esperar unos segundos para que el servicio inicie
echo "⏳ Esperando que el servicio inicie..."
sleep 5

# 6. Verificar que el contenedor esté corriendo
echo "✅ Verificando estado del contenedor..."
docker ps | grep gestion-riesgos-backend

# 7. Mostrar logs
echo "📋 Últimos logs del contenedor:"
docker compose logs --tail=50

# 8. Probar la API
echo "🧪 Probando endpoint de salud..."
curl -s http://localhost:8080/api/health | jq '.' || curl -s http://localhost:8080/api/health

echo ""
echo "✨ Deployment completado!"
echo "📝 Para ver logs en tiempo real: docker compose logs -f"
echo "🔍 Para verificar configuración residual: curl http://localhost:8080/api/configuracion-residual"
