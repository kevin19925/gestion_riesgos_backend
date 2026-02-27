# 🔴 PROBLEMA: Responsables de Procesos Aparecen Vacíos

## 📊 Diagnóstico

**Síntoma:** Los dueños de procesos aparecen vacíos en el frontend, aunque están guardados en la base de datos.

**Error relacionado:** Error 500 al intentar actualizar responsables del proceso 11.

## 🎯 Posibles Causas

### Causa 1: Campo `modo` es NULL en la base de datos ⚠️ (MÁS PROBABLE)

El schema de Prisma requiere que el campo `modo` sea obligatorio, pero los registros existentes en la base de datos pueden tener `modo = NULL`.

**Cómo verificar:**
```bash
# En Azure, conectar a la base de datos
psql "postgresql://azureuser:password@data-base-src.postgres.database.azure.com:5432/riesgos_db?sslmode=require"

# Ejecutar query
SELECT id, "procesoId", "usuarioId", modo 
FROM "ProcesoResponsable" 
WHERE modo IS NULL 
LIMIT 10;
```

**Solución:**
```bash
# Opción A: Usar el script de diagnóstico
npx ts-node diagnosticar-responsables.ts

# Opción B: Usar el script de fix
npx ts-node fix-responsables-modo.ts

# Opción C: SQL directo
UPDATE "ProcesoResponsable" 
SET modo = 'proceso' 
WHERE modo IS NULL;
```

### Causa 2: La columna `modo` no existe en la tabla

Si la migración de Prisma no se ejecutó, la columna `modo` puede no existir.

**Cómo verificar:**
```sql
-- En psql
\d "ProcesoResponsable"
```

**Solución:**
```bash
# Ejecutar migraciones pendientes
npx prisma migrate deploy

# O crear la columna manualmente
ALTER TABLE "ProcesoResponsable" ADD COLUMN modo VARCHAR(20);
UPDATE "ProcesoResponsable" SET modo = 'proceso' WHERE modo IS NULL;
ALTER TABLE "ProcesoResponsable" ALTER COLUMN modo SET NOT NULL;
```

### Causa 3: Caché de Redis desactualizado

El backend usa caché de Redis por 5 minutos. Si los datos cambiaron en la BD, el caché puede estar desactualizado.

**Solución:**
```bash
# Reiniciar el backend para limpiar caché
docker compose restart
```

### Causa 4: Backend no actualizado en Azure

El código desplegado en Azure puede ser una versión antigua que no lee correctamente el campo `modo`.

**Solución:**
```bash
# En Azure
cd ~/app-empresa
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🔧 Solución Paso a Paso

### Paso 1: Diagnosticar el problema

```bash
# Conectar a Azure
ssh usuario@IP-AZURE

# Ir al directorio del proyecto
cd ~/app-empresa

# Ejecutar script de diagnóstico
npx ts-node diagnosticar-responsables.ts
```

Este script te dirá:
- ✅ Cuántos responsables hay en total
- ⚠️ Cuántos tienen `modo = NULL`
- 📊 Distribución de modos (director/proceso)
- 🔍 Estado del proceso 11 específicamente

### Paso 2: Aplicar el fix (si hay registros con modo NULL)

```bash
# Ejecutar script de fix
npx ts-node fix-responsables-modo.ts
```

Este script:
- Asigna `modo = 'proceso'` a todos los registros con `modo = NULL`
- Verifica que el fix se aplicó correctamente

### Paso 3: Limpiar caché

```bash
# Reiniciar el backend
docker compose restart

# O reiniciar completamente
docker compose down
docker compose up -d
```

### Paso 4: Verificar en el frontend

1. Refrescar la página (Ctrl + F5)
2. Ir a la sección de procesos
3. Verificar que los responsables se muestren correctamente

## 📝 Scripts Creados

### 1. `diagnosticar-responsables.ts`
Diagnostica el problema y muestra información detallada.

**Uso:**
```bash
npx ts-node diagnosticar-responsables.ts
```

**Output esperado:**
```
========================================
DIAGNÓSTICO: Responsables de Procesos
========================================

1. Contando registros en ProcesoResponsable...
   Total de registros: 45

2. Verificando registros con modo NULL...
   Registros con modo NULL: 12

3. Distribución de modos...
   Distribución: { proceso: 33, NULL: 12 }

...
```

### 2. `fix-responsables-modo.ts`
Arregla automáticamente los responsables sin modo.

**Uso:**
```bash
npx ts-node fix-responsables-modo.ts
```

**Output esperado:**
```
========================================
ARREGLANDO: Responsables sin modo
========================================

1. Buscando responsables sin modo...
   Encontrados: 12 responsables sin modo

3. Aplicando fix...
   Asignando modo="proceso" a todos los responsables sin modo...

✅ Actualizados 12 registros

========================================
✅ FIX COMPLETADO EXITOSAMENTE
========================================
```

## 🔍 Verificación Manual en la Base de Datos

### Ver todos los responsables de un proceso:
```sql
SELECT 
  pr.id,
  pr."procesoId",
  pr.modo,
  u.nombre as usuario_nombre,
  p.nombre as proceso_nombre
FROM "ProcesoResponsable" pr
JOIN "Usuario" u ON pr."usuarioId" = u.id
JOIN "Proceso" p ON pr."procesoId" = p.id
WHERE pr."procesoId" = 11;
```

### Ver procesos sin responsables:
```sql
SELECT 
  p.id,
  p.nombre,
  COUNT(pr.id) as num_responsables
FROM "Proceso" p
LEFT JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId"
GROUP BY p.id, p.nombre
HAVING COUNT(pr.id) = 0;
```

### Ver responsables con modo NULL:
```sql
SELECT 
  pr.id,
  pr."procesoId",
  pr."usuarioId",
  pr.modo,
  p.nombre as proceso_nombre,
  u.nombre as usuario_nombre
FROM "ProcesoResponsable" pr
JOIN "Proceso" p ON pr."procesoId" = p.id
JOIN "Usuario" u ON pr."usuarioId" = u.id
WHERE pr.modo IS NULL;
```

## 🎯 Resumen de Soluciones

| Problema | Solución | Comando |
|----------|----------|---------|
| Modo NULL | Ejecutar fix | `npx ts-node fix-responsables-modo.ts` |
| Columna no existe | Migrar BD | `npx prisma migrate deploy` |
| Caché desactualizado | Reiniciar backend | `docker compose restart` |
| Código desactualizado | Redesplegar | `git pull && docker compose build --no-cache` |

## 📞 Si el Problema Persiste

1. Verificar logs del backend:
   ```bash
   docker compose logs -f | grep "responsables"
   ```

2. Verificar que el endpoint responda:
   ```bash
   curl https://api-erm.comware.com.co/api/procesos/11/responsables
   ```

3. Verificar en la consola del navegador (F12) qué datos está recibiendo el frontend

4. Verificar que el campo `responsablesList` esté en la respuesta de `/api/procesos`

---

**Fecha:** 27/02/2026  
**Archivos creados:**
- `diagnosticar-responsables.ts`
- `fix-responsables-modo.ts`
- `SOLUCION_RESPONSABLES_VACIOS.md` (este archivo)
