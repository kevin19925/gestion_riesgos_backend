# 🔴 ERROR: "Error al actualizar responsables" (500)

## 🐛 Diagnóstico

**Error:** `Failed to load resource: the server responded with a status of 500`  
**Endpoint:** `PUT /api/procesos/11/responsables`  
**Mensaje:** "Error al actualizar responsables"

## 🎯 Causa del Problema

El backend desplegado en Azure **NO tiene el código actualizado** del controlador `proceso-responsables.controller.ts`.

### Cambios Recientes (git pull):
```
Updating 13a71d5..ad42ae2
src/controllers/proceso-responsables.controller.ts | 57 ++++++++++------------
```

Este archivo fue actualizado para soportar el campo `modo` (director/proceso), pero el backend en Azure todavía tiene la versión antigua.

## ✅ Solución: Redesplegar el Backend

### Paso 1: Compilar localmente (verificar que funciona)
```powershell
cd gestion_riesgos_backend
npm run build
```

### Paso 2: Subir a Git
```powershell
git add .
git commit -m "fix: update proceso-responsables controller with modo field"
git push origin main
```

### Paso 3: Conectar a Azure
```bash
ssh usuario@IP-AZURE
```

### Paso 4: Actualizar código en Azure
```bash
cd ~/app-empresa
git pull origin main
```

### Paso 5: Reconstruir Docker
```bash
# Detener contenedor
docker compose down

# Reconstruir sin caché
docker compose build --no-cache

# Iniciar
docker compose up -d

# Ver logs para verificar
docker compose logs -f
```

### Paso 6: Verificar que funcione
```bash
# Desde Azure
curl http://localhost:8080/api/health

# Desde internet
curl https://api-erm.comware.com.co/api/health
```

## 🔍 Verificación del Error

Para ver el error exacto en los logs de Azure:

```bash
# Conectar a Azure
ssh usuario@IP-AZURE

# Ver logs del contenedor
cd ~/app-empresa
docker compose logs --tail=100 | grep "Error in updateResponsablesProceso"
```

## 📋 Formato de Datos Esperado

El endpoint espera este formato:

```json
{
  "responsables": [
    {
      "usuarioId": 5,
      "modo": "director"
    },
    {
      "usuarioId": 8,
      "modo": "proceso"
    }
  ]
}
```

**Importante:** El campo `modo` es obligatorio y debe ser `"director"` o `"proceso"`.

## ⚠️ Errores Comunes

### Error 1: Formato antiguo (sin modo)
```json
{
  "responsablesIds": [5, 8]  // ❌ Formato antiguo, no soportado
}
```

**Solución:** El frontend debe enviar el formato nuevo con `modo`.

### Error 2: Modo inválido
```json
{
  "responsables": [
    {
      "usuarioId": 5,
      "modo": "gerente"  // ❌ Modo inválido
    }
  ]
}
```

**Solución:** Solo se aceptan `"director"` o `"proceso"`.

### Error 3: Usuario no existe
```json
{
  "responsables": [
    {
      "usuarioId": 999,  // ❌ Usuario no existe
      "modo": "director"
    }
  ]
}
```

**Respuesta del servidor:**
```json
{
  "error": "Uno o más usuarios no existen",
  "usuariosFaltantes": [999]
}
```

## 🎯 Resumen

1. **Problema:** Backend en Azure tiene código desactualizado
2. **Solución:** Redesplegar con `git pull` + `docker compose build`
3. **Tiempo estimado:** 5-10 minutos
4. **Impacto:** Después del deployment, el error desaparecerá

## 📞 Si el Error Persiste

Si después de redesplegar el error continúa:

1. Verifica los logs: `docker compose logs -f`
2. Confirma que el build fue exitoso
3. Verifica que el frontend esté enviando el campo `modo`
4. Prueba el endpoint con Postman/curl directamente

### Ejemplo de prueba con curl:
```bash
curl -X PUT https://api-erm.comware.com.co/api/procesos/11/responsables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "responsables": [
      {"usuarioId": 5, "modo": "director"},
      {"usuarioId": 8, "modo": "proceso"}
    ]
  }'
```

---

**Fecha:** 27/02/2026  
**Estado:** Pendiente de deployment en Azure
