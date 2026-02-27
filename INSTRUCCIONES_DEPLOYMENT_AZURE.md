# 🚀 Instrucciones para Deployment en Azure

## Problema Actual
El backend en Azure está mostrando error 404 en `/api/configuracion-residual` porque no tiene el código actualizado.

## ✅ Código Verificado (Todo está correcto localmente)

- ✅ Rutas: `src/routes/configuracionResidual.routes.ts`
- ✅ Controlador: `src/controllers/configuracionResidual.controller.ts`
- ✅ Servicios: `src/services/configuracionResidual.service.ts` y `recalculoResidual.service.ts`
- ✅ Registro en: `src/routes/index.ts` (línea 60)
- ✅ Schema Prisma: Modelo `ConfiguracionResidual` existe

## 📋 Pasos para Actualizar el Backend en Azure

### Opción 1: Usando SSH (Recomendado)

1. **Conectarse a la VM de Azure:**
   ```bash
   ssh usuario@IP-AZURE
   ```

2. **Navegar al directorio del proyecto:**
   ```bash
   cd ~/app-empresa
   # O el directorio donde esté el backend
   ```

3. **Actualizar el código desde Git:**
   ```bash
   git pull origin main
   ```

4. **Reconstruir y redesplegar:**
   ```bash
   # Detener contenedor
   docker compose down
   
   # Reconstruir sin caché
   docker compose build --no-cache
   
   # Iniciar
   docker compose up -d
   
   # Ver logs
   docker compose logs -f
   ```

5. **Verificar que funcione:**
   ```bash
   curl http://localhost:8080/api/configuracion-residual
   ```

### Opción 2: Usando Azure Portal

1. Ve a Azure Portal → Tu VM
2. Click en "Run Command" → "RunShellScript"
3. Ejecuta:
   ```bash
   cd ~/app-empresa
   git pull origin main
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

### Opción 3: Subir archivos manualmente (Si no tienes Git en Azure)

1. **Comprimir los archivos necesarios:**
   ```powershell
   # En tu máquina local
   cd gestion_riesgos_backend
   
   # Crear zip con los archivos actualizados
   Compress-Archive -Path src/routes/configuracionResidual.routes.ts, `
     src/controllers/configuracionResidual.controller.ts, `
     src/services/configuracionResidual.service.ts, `
     src/services/recalculoResidual.service.ts, `
     src/routes/index.ts `
     -DestinationPath backend-update.zip
   ```

2. **Subir a Azure usando SCP o Azure Portal:**
   ```bash
   scp backend-update.zip usuario@IP-AZURE:~/
   ```

3. **En la VM de Azure, descomprimir y reconstruir:**
   ```bash
   cd ~/app-empresa
   unzip ~/backend-update.zip -d .
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

## 🔍 Verificación Post-Deployment

### 1. Verificar que el contenedor esté corriendo:
```bash
docker ps | grep gestion-riesgos-backend
```

### 2. Ver logs en tiempo real:
```bash
docker compose logs -f
```

### 3. Probar endpoints:
```bash
# Health check
curl http://localhost:8080/api/health

# Configuración residual
curl http://localhost:8080/api/configuracion-residual

# Desde el navegador (URL pública)
https://api-erm.comware.com.co/api/configuracion-residual
```

## 🐛 Troubleshooting

### Si el contenedor no inicia:
```bash
# Ver logs de error
docker compose logs

# Verificar que el .env esté correcto
cat .env

# Verificar que la base de datos esté accesible
docker compose exec app npx prisma db pull
```

### Si sigue dando 404:
```bash
# Verificar que el archivo compilado existe
docker compose exec app ls -la dist/routes/configuracionResidual.routes.js

# Verificar que el index.js tenga la ruta registrada
docker compose exec app cat dist/routes/index.js | grep configuracion-residual
```

### Si hay errores de compilación:
```bash
# Limpiar todo y reconstruir
docker compose down
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

## 📝 Notas Importantes

- El backend usa el puerto **8080**
- La base de datos está en Azure PostgreSQL
- El archivo `.env` debe tener `DATABASE_URL` configurado
- Después de actualizar, el frontend debería poder acceder a la ruta sin problemas

## 🔗 URLs Importantes

- Backend local: `http://localhost:8080/api`
- Backend Azure: `https://api-erm.comware.com.co/api`
- Health check: `/api/health`
- Configuración residual: `/api/configuracion-residual`
