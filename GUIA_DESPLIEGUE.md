# Guía de Pruebas Locales y Despliegue en Render

## 📋 Pasos para Probar Localmente Primero

### 1. Configurar variables de entorno locales

Crea un archivo `.env` en la carpeta `gestion_riesgos_backend/` con:

```env
# Base de datos de Render (copia la URL desde el dashboard de Render)
DATABASE_URL="postgresql://usuario:password@host:puerto/database?sslmode=require"
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**📌 Cómo obtener la DATABASE_URL de Render:**

1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Busca tu base de datos PostgreSQL (no el servicio web, sino la base de datos)
3. Haz clic en "Connections" o "Info"
4. Copia la "Internal Database URL" o "External Database URL"
5. Pégala en tu archivo `.env` local

**⚠️ Importante:** 
- Si usas la misma base de datos de Render, los cambios que hagas localmente afectarán los datos de producción
- Considera usar una base de datos de prueba si quieres experimentar sin riesgo

### 2. Instalar dependencias (si es necesario)

```bash
cd gestion_riesgos_backend
npm install
```

### 3. Generar Prisma Client

```bash
npx prisma generate
```

### 4. Ejecutar el servidor en modo desarrollo

```bash
npm run dev
```

Esto iniciará el servidor con `nodemon`, que se reinicia automáticamente cuando haces cambios.

Deberías ver:
```
Server running on port 8080
```

### 5. Verificar que el endpoint DELETE funciona

Abre tu navegador o usa Postman/Thunder Client para probar:

```
DELETE http://localhost:8080/api/riesgos/causas/25
```

O desde la aplicación frontend, asegúrate de que `VITE_API_BASE_URL` apunte a `http://localhost:8080/api` en tu `.env` del frontend.

### 6. Probar la eliminación de causas

1. Abre la aplicación frontend (debe estar corriendo en `http://localhost:5173`)
2. Ve a la página de Identificación y Calificación
3. Intenta eliminar una causa
4. Verifica en la consola del navegador y del servidor que todo funcione

---

## 🚀 Pasos para Subir a Render

### Opción 1: Usando Git (Recomendado)

1. **Verificar que todos los cambios estén guardados:**
   ```bash
   git status
   ```

2. **Agregar los archivos modificados:**
   ```bash
   git add .
   ```

3. **Hacer commit de los cambios:**
   ```bash
   git commit -m "Agregar endpoint DELETE para causas y mejoras en manejo de errores"
   ```

4. **Subir a la rama main (o la rama que uses en Render):**
   ```bash
   git push origin main
   ```

5. **Render detectará automáticamente el push y desplegará:**
   - Ve a tu dashboard de Render
   - Verás que el servicio se está reconstruyendo
   - Espera a que termine el build (puede tardar 2-5 minutos)

### Opción 2: Despliegue Manual en Render

1. **Ve a tu dashboard de Render:**
   - https://dashboard.render.com

2. **Selecciona tu servicio `gestion-riesgos-backend`**

3. **Haz clic en "Manual Deploy" → "Deploy latest commit"**

4. **Espera a que termine el build**

---

## ✅ Verificar el Despliegue

### 1. Verificar los logs en Render

En el dashboard de Render, ve a la sección "Logs" de tu servicio y verifica que:
- El build se completó exitosamente
- El servidor se inició correctamente
- No hay errores de compilación

### 2. Verificar que el endpoint funciona

Puedes probar el endpoint directamente:

```bash
# Reemplaza TU_URL_RENDER con la URL de tu servicio en Render
curl -X DELETE https://TU_URL_RENDER.onrender.com/api/riesgos/causas/25 \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json"
```

O desde la aplicación frontend desplegada, verifica que:
- `VITE_API_BASE_URL` apunte a la URL de Render
- La eliminación de causas funcione correctamente

---

## 🔍 Troubleshooting

### Si el servidor no inicia localmente:

1. **Verifica que el puerto 8080 no esté en uso:**
   ```bash
   # Windows
   netstat -ano | findstr :8080
   
   # Linux/Mac
   lsof -i :8080
   ```

2. **Verifica que la base de datos esté accesible:**
   - Prueba la conexión con `npx prisma studio` o `npx prisma db pull`

### Si el despliegue en Render falla:

1. **Revisa los logs de build en Render:**
   - Busca errores de compilación TypeScript
   - Verifica que todas las dependencias se instalaron correctamente

2. **Verifica las variables de entorno en Render:**
   - `DATABASE_URL` debe estar configurada
   - `PORT` debe estar configurada (Render la asigna automáticamente)
   - `CORS_ORIGIN` debe apuntar a la URL de tu frontend

3. **Verifica que el build command sea correcto:**
   - Debe ser: `npm install && npm run build`
   - Debe generar la carpeta `dist/` con los archivos compilados

---

## 📝 Resumen de Comandos

### Desarrollo Local:
```bash
cd gestion_riesgos_backend
npm install
npx prisma generate
npm run dev
```

### Despliegue:
```bash
git add .
git commit -m "Descripción de los cambios"
git push origin main
# Render desplegará automáticamente
```

---

## 🎯 Checklist Pre-Despliegue

Antes de subir a Render, verifica:

- [ ] El código funciona correctamente en local
- [ ] Todos los tests pasan (si los hay)
- [ ] No hay errores de TypeScript (`npm run build` funciona)
- [ ] Los cambios están commiteados
- [ ] Las variables de entorno en Render están configuradas
- [ ] El frontend apunta a la URL correcta de Render

