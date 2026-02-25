# ANÁLISIS DE IMPACTO: Cambio de Restricción Única en ProcesoResponsable

## FECHA: 2026-02-25

## PROBLEMA ACTUAL
La restricción única `@@unique([procesoId, usuarioId])` impide que un gerente sea asignado al mismo proceso en ambos modos (dueño y supervisor).

## CAMBIO PROPUESTO
Cambiar de:
```prisma
@@unique([procesoId, usuarioId])
```

A:
```prisma
@@unique([procesoId, usuarioId, modo])
```

---

## ANÁLISIS EXHAUSTIVO DE IMPACTO

### 1. BACKEND - Controllers

#### ✅ `proceso-responsables.controller.ts`
**Funciones afectadas:**
- `addResponsableToProceso()` - Línea 89-90
  - **USO ACTUAL:** `procesoId_usuarioId` en `upsert`
  - **IMPACTO:** ⚠️ REQUIERE CAMBIO
  - **ACCIÓN:** Cambiar a `procesoId_usuarioId_modo`

- `removeResponsableFromProceso()` - Línea 143-144
  - **USO ACTUAL:** `procesoId_usuarioId` en `delete`
  - **IMPACTO:** ⚠️ REQUIERE CAMBIO
  - **ACCIÓN:** Cambiar a `procesoId_usuarioId_modo` y agregar parámetro `modo`

- `updateResponsablesProceso()` - Línea 256-260
  - **USO ACTUAL:** `deleteMany` + `create` múltiples
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Usa `deleteMany` (no depende de restricción única) y `create` (funcionará con nueva restricción)

- `getResponsablesByProceso()` - Línea 16
  - **USO ACTUAL:** `findMany` con `where: { procesoId }`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Solo consulta, no usa restricción única

#### ✅ `procesos.controller.ts`
**Funciones afectadas:**
- `getProcesos()` - Línea 10-30
  - **USO ACTUAL:** Lee `responsables` con `include`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Solo lectura, funcionará igual con múltiples registros

- `getProcesoById()` - Línea 83-86
  - **USO ACTUAL:** Lee `responsables` con `include`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Solo lectura, funcionará igual

---

### 2. FRONTEND - Hooks y Contextos

#### ✅ `useAsignaciones.ts`
**Funciones afectadas:**
- `esUsuarioResponsableProceso()` - Línea 13-27
  - **USO ACTUAL:** Verifica si usuario está en `responsablesList`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Ya maneja arrays de responsables, funcionará con múltiples modos

- `useAreasProcesosAsignados()` - Línea 32-106
  - **USO ACTUAL:** Filtra por `modo` en `responsablesList`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Ya está preparado para manejar múltiples modos por usuario

#### ✅ `ProcesoContext.tsx`
**Funciones afectadas:**
- `puedeGestionarProcesos` - Línea 117-123
  - **USO ACTUAL:** Usa `esUsuarioResponsableProceso()`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Delega en función que ya maneja múltiples responsables

---

### 3. FRONTEND - Páginas

#### ✅ `AreasPage.tsx`
**Funciones afectadas:**
- `handleProcessToggle()` - Línea 368-400
  - **USO ACTUAL:** Maneja múltiples responsables con modo
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Ya está diseñado para manejar múltiples modos

- `saveAssignments()` - Línea 442-475
  - **USO ACTUAL:** Envía array de `{ usuarioId, modo }`
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Backend ya maneja correctamente con `updateResponsablesProceso`

- `isProcesoResponsable()` - Línea 540-552
  - **USO ACTUAL:** Verifica responsables con modo específico
  - **IMPACTO:** ✅ NO REQUIERE CAMBIO
  - **RAZÓN:** Ya maneja múltiples modos correctamente

---

### 4. BASE DE DATOS

#### ⚠️ Schema Prisma
**Archivo:** `gestion_riesgos_backend/prisma/schema.prisma`
- **LÍNEA 115:** `@@unique([procesoId, usuarioId])`
- **IMPACTO:** ⚠️ REQUIERE CAMBIO
- **ACCIÓN:** Cambiar a `@@unique([procesoId, usuarioId, modo])`

#### ⚠️ Migración
- **IMPACTO:** ⚠️ REQUIERE NUEVA MIGRACIÓN
- **ACCIÓN:** Crear migración para cambiar restricción única

---

## RESUMEN DE CAMBIOS NECESARIOS

### CAMBIOS OBLIGATORIOS (3)

1. **Schema Prisma** - `schema.prisma` línea 115
   - Cambiar restricción única

2. **Controller** - `proceso-responsables.controller.ts` línea 89-90
   - Actualizar `addResponsableToProceso()` para usar nueva restricción

3. **Controller** - `proceso-responsables.controller.ts` línea 143-144
   - Actualizar `removeResponsableFromProceso()` para usar nueva restricción

### CAMBIOS OPCIONALES (0)
Ninguno. El resto del código ya está preparado.

---

## DATOS EXISTENTES

### ⚠️ VERIFICACIÓN NECESARIA
Antes de aplicar la migración, verificar si hay datos existentes que violen la nueva restricción:

```sql
-- Buscar usuarios con múltiples registros en el mismo proceso
SELECT procesoId, usuarioId, COUNT(*) as count
FROM ProcesoResponsable
GROUP BY procesoId, usuarioId
HAVING COUNT(*) > 1;
```

**RESULTADO ESPERADO:** 0 registros (porque la restricción actual lo impide)

---

## RIESGOS IDENTIFICADOS

### ✅ RIESGO BAJO
1. **Datos existentes:** No hay riesgo porque la restricción actual impide duplicados
2. **Código frontend:** Ya está preparado para múltiples modos
3. **Queries de lectura:** No se ven afectadas

### ⚠️ RIESGO MEDIO
1. **Funciones de eliminación:** Requieren actualización para especificar modo
2. **Funciones de upsert:** Requieren actualización de restricción única

### ❌ RIESGO ALTO
Ninguno identificado.

---

## PLAN DE IMPLEMENTACIÓN SEGURO

### FASE 1: Preparación (5 minutos)
1. ✅ Backup de base de datos
2. ✅ Verificar datos existentes (query arriba)
3. ✅ Commit de código actual

### FASE 2: Cambios en Código (10 minutos)
1. ⚠️ Actualizar `schema.prisma`
2. ⚠️ Actualizar `addResponsableToProceso()`
3. ⚠️ Actualizar `removeResponsableFromProceso()`

### FASE 3: Migración (5 minutos)
1. ⚠️ Generar migración: `npx prisma migrate dev --name allow_multiple_modes_per_user`
2. ⚠️ Aplicar migración
3. ⚠️ Verificar schema actualizado

### FASE 4: Pruebas (10 minutos)
1. ✅ Asignar Alicia Robayo en Modo Director
2. ✅ Asignar Alicia Robayo en Modo Proceso (mismo proceso)
3. ✅ Verificar que ambas asignaciones coexisten
4. ✅ Probar eliminación de un modo (debe mantener el otro)
5. ✅ Verificar que Juan Jose Maldonado sigue funcionando

### FASE 5: Rollback (si es necesario)
1. ❌ Restaurar backup de base de datos
2. ❌ Revertir commit de código

---

## CONCLUSIÓN

### ✅ CAMBIO SEGURO
- Solo 3 funciones requieren actualización
- El resto del código ya está preparado
- No hay datos existentes que puedan causar conflictos
- Rollback es simple si algo falla

### ✅ BENEFICIOS
- Permite asignar gerentes en ambos modos al mismo proceso
- Mantiene integridad de datos
- Código más claro y mantenible

### ✅ RECOMENDACIÓN
**PROCEDER CON EL CAMBIO** - El impacto es mínimo y controlado.

---

## PRÓXIMOS PASOS

¿Deseas que proceda con la implementación siguiendo este plan?
