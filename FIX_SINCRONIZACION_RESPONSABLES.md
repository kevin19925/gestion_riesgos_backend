# ✅ FIX: Sincronización Automática de Responsables

## 🎯 Problema Resuelto

Cuando se asignaba un "dueño de proceso" (campo `responsableId`), el sistema NO creaba automáticamente el registro en la tabla `ProcesoResponsable` con `modo = "proceso"`.

Esto causaba que:
- ❌ Los responsables aparecieran vacíos en el frontend
- ❌ Al intentar guardar asignaciones, daba error: "Cada responsable debe tener modo 'director' o 'proceso'"

## 🔧 Solución Implementada

Se modificaron 3 funciones en `src/controllers/procesos.controller.ts`:

### 1. `createProceso` - Crear Proceso

**Antes:**
```typescript
const nuevoProceso = await prisma.proceso.create({ data });
// ❌ No creaba registro en ProcesoResponsable
```

**Después:**
```typescript
const nuevoProceso = await prisma.proceso.create({ data });

// ✅ Crear registro en ProcesoResponsable automáticamente
if (responsableId && Number(responsableId) > 0) {
    await prisma.procesoResponsable.upsert({
        where: {
            procesoId_usuarioId_modo: {
                procesoId: nuevoProceso.id,
                usuarioId: Number(responsableId),
                modo: 'proceso'
            }
        },
        create: {
            procesoId: nuevoProceso.id,
            usuarioId: Number(responsableId),
            modo: 'proceso'
        },
        update: {}
    });
}
```

### 2. `updateProceso` - Actualizar Proceso

**Antes:**
```typescript
if (responsableId) updateData.responsableId = Number(responsableId);
// ❌ No sincronizaba ProcesoResponsable
```

**Después:**
```typescript
// Guardar responsableId anterior
const procesoAnterior = await prisma.proceso.findUnique({
    where: { id },
    select: { responsableId: true }
});

if (responsableId !== undefined) {
    updateData.responsableId = responsableId ? Number(responsableId) : null;
}

// Actualizar proceso
const proceso = await prisma.proceso.update({ where: { id }, data: updateData });

// ✅ Sincronizar ProcesoResponsable
if (responsableId !== undefined) {
    const nuevoResponsableId = responsableId ? Number(responsableId) : null;
    const anteriorResponsableId = procesoAnterior?.responsableId;

    if (nuevoResponsableId !== anteriorResponsableId) {
        // Eliminar responsable anterior con modo="proceso"
        if (anteriorResponsableId) {
            await prisma.procesoResponsable.deleteMany({
                where: {
                    procesoId: id,
                    usuarioId: anteriorResponsableId,
                    modo: 'proceso'
                }
            });
        }

        // Crear nuevo responsable con modo="proceso"
        if (nuevoResponsableId && nuevoResponsableId > 0) {
            await prisma.procesoResponsable.upsert({
                where: {
                    procesoId_usuarioId_modo: {
                        procesoId: id,
                        usuarioId: nuevoResponsableId,
                        modo: 'proceso'
                    }
                },
                create: {
                    procesoId: id,
                    usuarioId: nuevoResponsableId,
                    modo: 'proceso'
                },
                update: {}
            });
        }
    }
}
```

### 3. `bulkUpdateProcesos` - Actualización Masiva

Similar a `updateProceso`, pero para múltiples procesos a la vez.

## 📊 Cómo Funciona Ahora

### Flujo de Creación:
```
1. Usuario asigna "Dueño de Proceso" en el frontend
   ↓
2. Frontend envía: { responsableId: 5, ... }
   ↓
3. Backend crea registro en tabla Proceso
   ↓
4. Backend AUTOMÁTICAMENTE crea registro en ProcesoResponsable:
   - procesoId: [ID del proceso]
   - usuarioId: 5
   - modo: "proceso"
   ↓
5. Frontend lee responsables y los muestra correctamente
```

### Flujo de Actualización:
```
1. Usuario cambia "Dueño de Proceso" de Usuario A a Usuario B
   ↓
2. Frontend envía: { responsableId: 8, ... }
   ↓
3. Backend actualiza tabla Proceso
   ↓
4. Backend AUTOMÁTICAMENTE:
   - Elimina registro de Usuario A con modo="proceso"
   - Crea registro de Usuario B con modo="proceso"
   ↓
5. Frontend muestra Usuario B como responsable
```

## 🎯 Beneficios

✅ **Sincronización automática:** No más responsables vacíos
✅ **Consistencia de datos:** Proceso.responsableId siempre sincronizado con ProcesoResponsable
✅ **Sin errores:** Ya no aparece "Cada responsable debe tener modo"
✅ **Retrocompatibilidad:** Funciona con procesos existentes

## 🔄 Migración de Datos Existentes

Para procesos que ya tienen `responsableId` pero NO tienen registro en `ProcesoResponsable`:

### Opción 1: Script Automático
```bash
npx ts-node migrar-responsables-existentes.ts
```

### Opción 2: SQL Directo
```sql
-- Crear registros en ProcesoResponsable para procesos con responsableId
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", modo, "createdAt")
SELECT 
    id as "procesoId",
    "responsableId" as "usuarioId",
    'proceso' as modo,
    NOW() as "createdAt"
FROM "Proceso"
WHERE "responsableId" IS NOT NULL
AND NOT EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = "Proceso".id 
    AND pr."usuarioId" = "Proceso"."responsableId" 
    AND pr.modo = 'proceso'
);
```

## 📝 Verificación

### 1. Verificar que funciona al crear:
```bash
# Crear un proceso con responsable
curl -X POST https://api-erm.comware.com.co/api/procesos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Proceso Test",
    "descripcion": "Test",
    "objetivo": "Test",
    "tipo": "Operacional",
    "responsableId": 5
  }'

# Verificar que se creó en ProcesoResponsable
curl https://api-erm.comware.com.co/api/procesos/[ID]/responsables
```

### 2. Verificar que funciona al actualizar:
```bash
# Actualizar responsable
curl -X PUT https://api-erm.comware.com.co/api/procesos/11 \
  -H "Content-Type: application/json" \
  -d '{
    "responsableId": 8
  }'

# Verificar que se actualizó en ProcesoResponsable
curl https://api-erm.comware.com.co/api/procesos/11/responsables
```

## 🚀 Deployment

### Paso 1: Compilar
```bash
npm run build
```

### Paso 2: Subir a Git
```bash
git add src/controllers/procesos.controller.ts
git commit -m "fix: auto-sync responsableId with ProcesoResponsable table"
git push origin main
```

### Paso 3: Desplegar en Azure
```bash
# Conectar a Azure
ssh usuario@IP-AZURE

# Actualizar código
cd ~/app-empresa
git pull origin main

# Reconstruir Docker
docker compose down
docker compose build --no-cache
docker compose up -d

# Verificar logs
docker compose logs -f
```

### Paso 4: Migrar Datos Existentes
```bash
# Ejecutar script de migración
npx ts-node migrar-responsables-existentes.ts
```

### Paso 5: Limpiar Caché
```bash
# Reiniciar backend para limpiar caché de Redis
docker compose restart
```

## ✅ Checklist Post-Deployment

- [ ] Backend desplegado en Azure
- [ ] Datos existentes migrados
- [ ] Caché limpiado
- [ ] Crear nuevo proceso con responsable → Verificar que aparece
- [ ] Actualizar responsable de proceso existente → Verificar que cambia
- [ ] Frontend muestra responsables correctamente
- [ ] No aparece error "Cada responsable debe tener modo"

---

**Fecha:** 27/02/2026  
**Archivos modificados:**
- `src/controllers/procesos.controller.ts`

**Archivos creados:**
- `FIX_SINCRONIZACION_RESPONSABLES.md` (este archivo)
- `migrar-responsables-existentes.ts` (próximo)
