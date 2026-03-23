# Migración de Normalización - Estado Actual

## ✅ COMPLETADO

### 1. Schema de Prisma Actualizado
El archivo `prisma/schema.prisma` ha sido completamente actualizado con todos los cambios:

- **Usuario**: Eliminado campo `role` (texto), renombrada relación a `roleRelacion`
- **Proceso**: Eliminado `gerencia` (texto), agregado `gerenciaId` (FK) con relación
- **Riesgo**: Eliminados `tipologiaTipo3` y `tipologiaTipo4` (texto), agregados `tipologiaTipo3Id` y `tipologiaTipo4Id` (FK)
- **CausaRiesgo**: Eliminados `gestion` (JSONB) y `tipoGestion`, agregada relación con `HistorialEstadoPlan`
- **ControlRiesgo**: Agregados 5 nuevos campos migrados desde `gestion`
- **PlanAccion**: Agregados `tipoGestion` y `origenMigracion`
- **Nuevos modelos**: `HistorialEstadoPlan` y `TipologiaRiesgoExtendida`

### 2. Controlador de Riesgos Actualizado
`src/controllers/riesgos.controller.ts`:

- ✅ `createCausa`: Eliminadas referencias a `gestion` y `tipoGestion`
- ✅ `updateCausa`: Eliminadas referencias a `gestion` y `tipoGestion`, actualizada documentación
- ✅ Creación de riesgos: Cambiado de `tipologiaTipo3/4` (texto) a `tipologiaTipo3Id/4Id` (número)
- ✅ Actualización de riesgos: Cambiado de `tipologiaTipo3/4` (texto) a `tipologiaTipo3Id/4Id` (número)
- ✅ Select de riesgos: Agregadas relaciones `tipologiaTipo3Relacion` y `tipologiaTipo4Relacion`

### 3. Script de Migración SQL
Creado `migrations/normalizacion_completa.sql` con:
- Creación de tablas nuevas
- Agregado de columnas nuevas
- Instrucciones para eliminar columnas obsoletas (comentadas por seguridad)
- Queries de verificación post-migración

## ⚠️ PENDIENTE - REQUIERE REFACTORIZACIÓN

### Servicios que Usan `gestion` JSONB

Estos servicios necesitan ser completamente refactorizados para trabajar con las tablas normalizadas:

#### 1. `src/services/recalculoResidual.service.ts` (CRÍTICO)
**Problema**: Lee y escribe intensivamente en `CausaRiesgo.gestion` (JSONB)

**Solución requerida**:
```typescript
// ANTES: Leer desde gestion JSONB
const gestion = causa.gestion || {};
const puntajes = {
  aplicabilidad: gestion.puntajeAplicabilidad || 0,
  // ...
};

// DESPUÉS: Leer desde ControlRiesgo
const control = await prisma.controlRiesgo.findFirst({
  where: { causaRiesgoId: causa.id }
});
const puntajes = {
  aplicabilidad: control?.aplicabilidad || 0,
  // ...
};
```

**Cambios necesarios**:
- Reemplazar todas las lecturas de `gestion.*` por queries a `ControlRiesgo`
- Actualizar `ControlRiesgo` directamente en lugar de `CausaRiesgo.gestion`
- Actualizar `EvaluacionRiesgo` para valores residuales
- Eliminar filtros `tipoGestion: { in: ['CONTROL', 'AMBOS'] }`
- Filtrar por existencia de registros en `ControlRiesgo` en su lugar

#### 2. `src/services/alertas-vencimiento.service.ts`
**Problema**: Lee planes desde `CausaRiesgo.gestion`

**Solución requerida**:
```typescript
// ANTES
const gestion = causa.gestion as any;
if (!gestion || !gestion.planFechaEstimada) return false;

// DESPUÉS
const plan = await prisma.planAccion.findFirst({
  where: { causaRiesgoId: causa.id }
});
if (!plan || !plan.fechaFin) return false;
```

**Cambios necesarios**:
- Reemplazar lecturas de `gestion.plan*` por queries a `PlanAccion`
- Filtrar por `PlanAccion.causaRiesgoId` en lugar de `tipoGestion`
- Usar `PlanAccion.fechaFin` en lugar de `gestion.planFechaEstimada`
- Usar `PlanAccion.estado` en lugar de `gestion.planEstado`

#### 3. `src/controllers/plan-trazabilidad.controller.ts`
**Problema**: Gestiona planes y estados en `CausaRiesgo.gestion`

**Solución requerida**:
```typescript
// ANTES
const gestion = (causa.gestion as any) || {};
const gestionActualizada = {
  ...gestion,
  planEstado: estado,
  historialEstados: [...]
};
await prisma.causaRiesgo.update({
  where: { id },
  data: { gestion: gestionActualizada }
});

// DESPUÉS
await prisma.planAccion.update({
  where: { causaRiesgoId: causaId },
  data: { estado }
});
await prisma.historialEstadoPlan.create({
  data: {
    causaRiesgoId: causaId,
    estado,
    // ...
  }
});
```

**Cambios necesarios**:
- Actualizar `PlanAccion` directamente
- Crear registros en `HistorialEstadoPlan` para cambios de estado
- Eliminar toda manipulación del objeto `gestion`
- Actualizar endpoint `obtenerPlanesAccion` para leer desde `PlanAccion`

### Otras Referencias Menores

#### 4. `src/controllers/procesos.controller.ts`
```typescript
// Línea 95: Cambiar
role: r.usuario.role?.codigo || null,
// Por:
role: r.usuario.roleRelacion?.codigo || null,
```

#### 5. `src/middleware/audit.middleware.ts`
```typescript
// Línea 61: Cambiar
usuarioRole = usuario.role?.codigo || usuarioRole;
// Por:
usuarioRole = usuario.roleRelacion?.codigo || usuarioRole;
```

## 📋 CHECKLIST DE TAREAS PENDIENTES

- [ ] Refactorizar `recalculoResidual.service.ts`
  - [ ] Reemplazar lecturas de `gestion` por queries a `ControlRiesgo`
  - [ ] Actualizar `ControlRiesgo` directamente
  - [ ] Eliminar filtros por `tipoGestion`
  - [ ] Probar recálculo residual completo

- [ ] Refactorizar `alertas-vencimiento.service.ts`
  - [ ] Reemplazar lecturas de `gestion` por queries a `PlanAccion`
  - [ ] Actualizar lógica de generación de alertas
  - [ ] Probar generación de alertas

- [ ] Refactorizar `plan-trazabilidad.controller.ts`
  - [ ] Actualizar `actualizarEstadoPlan` para usar `PlanAccion` y `HistorialEstadoPlan`
  - [ ] Actualizar `convertirPlanAControl` para trabajar con tablas normalizadas
  - [ ] Actualizar `obtenerPlanesAccion` para leer desde `PlanAccion`
  - [ ] Probar todos los endpoints

- [ ] Actualizar referencias menores
  - [ ] `procesos.controller.ts` - Usuario.roleRelacion
  - [ ] `audit.middleware.ts` - Usuario.roleRelacion

- [ ] Crear endpoints CRUD para `TipologiaRiesgoExtendida`
  - [ ] GET /api/catalogos/tipologias-extendidas
  - [ ] POST /api/catalogos/tipologias-extendidas
  - [ ] PUT /api/catalogos/tipologias-extendidas/:id
  - [ ] DELETE /api/catalogos/tipologias-extendidas/:id

- [ ] Generar y aplicar migración de Prisma
  - [ ] `npx prisma migrate dev --name normalizacion_completa`
  - [ ] Verificar que no hay errores
  - [ ] Ejecutar queries de verificación

- [ ] Pruebas
  - [ ] Probar creación y edición de riesgos con tipologías 3 y 4
  - [ ] Probar creación y edición de causas
  - [ ] Probar recálculo residual
  - [ ] Probar alertas de vencimiento
  - [ ] Probar trazabilidad de planes
  - [ ] Probar conversión de planes a controles

- [ ] Actualizar frontend (si es necesario)
  - [ ] Verificar que envía `tipologiaTipo3Id/4Id` en lugar de texto
  - [ ] Verificar que no envía `gestion` ni `tipoGestion` en causas
  - [ ] Actualizar tipos TypeScript si es necesario

## 🚀 ORDEN DE EJECUCIÓN RECOMENDADO

1. **Primero**: Generar migración de Prisma y aplicarla en desarrollo
2. **Segundo**: Refactorizar servicios en este orden:
   - `recalculoResidual.service.ts` (más crítico)
   - `alertas-vencimiento.service.ts`
   - `plan-trazabilidad.controller.ts`
3. **Tercero**: Actualizar referencias menores
4. **Cuarto**: Crear endpoints para tipologías extendidas
5. **Quinto**: Pruebas exhaustivas
6. **Sexto**: Desplegar en producción

## ⚠️ ADVERTENCIAS

- **NO eliminar las columnas obsoletas** hasta verificar que todo funciona correctamente
- Las líneas comentadas en `normalizacion_completa.sql` solo deben ejecutarse después de pruebas exitosas
- Hacer backup de la base de datos antes de aplicar cambios
- Probar primero en ambiente de desarrollo/staging

## 📝 NOTAS

- Los datos ya fueron migrados en la base de datos
- El schema de Prisma ya está actualizado
- El controlador de riesgos ya está parcialmente actualizado
- Los servicios críticos aún necesitan refactorización completa
