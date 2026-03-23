# Análisis de Migración de Normalización - Backend

## Estado Actual

La migración de normalización en la base de datos PostgreSQL ya se completó. Los datos que estaban en campos JSONB y de texto fueron movidos a tablas normalizadas.

## Cambios Realizados en schema.prisma

### 1. Usuario - Eliminado campo `role` (texto)
- ✅ Eliminado: `roleTexto` (mapeado a `role`)
- ✅ Renombrado: `role` → `roleRelacion` (relación con tabla Role)
- Impacto: Bajo - Solo 2 referencias en el código

### 2. Proceso - Reemplazado `gerencia` (texto) por `gerenciaId` (FK)
- ✅ Eliminado: `gerencia` (String)
- ✅ Agregado: `gerenciaId` (Int?, FK a Gerencia)
- ✅ Agregada relación: `gerencia` (Gerencia?)
- Impacto: Bajo - No se encontraron referencias directas en el backend

### 3. Riesgo - Reemplazadas tipologías 3 y 4 (texto) por FK
- ✅ Eliminado: `tipologiaTipo3` (String)
- ✅ Eliminado: `tipologiaTipo4` (String)
- ✅ Agregado: `tipologiaTipo3Id` (Int?, FK)
- ✅ Agregado: `tipologiaTipo4Id` (Int?, FK)
- ✅ Agregadas relaciones con `TipologiaRiesgoExtendida`
- ✅ Agregado modelo `TipologiaRiesgoExtendida`
- Impacto: Medio - 3 archivos afectados (riesgos.controller.ts)

### 4. CausaRiesgo - Eliminados `gestion` (JSONB) y `tipoGestion`
- ✅ Eliminado: `gestion` (Json)
- ✅ Eliminado: `tipoGestion` (String)
- ✅ Agregada relación: `historialEstados` (HistorialEstadoPlan[])
- Impacto: ALTO - Múltiples servicios y controladores afectados

### 5. ControlRiesgo - Nuevos campos migrados desde gestion
- ✅ Agregado: `descripcionControl` (String?)
- ✅ Agregado: `recomendacion` (String?)
- ✅ Agregado: `tipoMitigacion` (String?)
- ✅ Agregado: `estadoAmbos` (String?)
- ✅ Agregado: `recalculadoEn` (DateTime?)

### 6. PlanAccion - Nuevos campos migrados desde gestion
- ✅ Agregado: `tipoGestion` (String?)
- ✅ Agregado: `origenMigracion` (Boolean)

### 7. Nuevos modelos
- ✅ `HistorialEstadoPlan` - Historial de estados de planes
- ✅ `TipologiaRiesgoExtendida` - Tipologías nivel 3 y 4

## Archivos Actualizados

### Schema y Modelos
- ✅ `prisma/schema.prisma` - Actualizado completamente

### Controladores
- ✅ `controllers/riesgos.controller.ts` - Actualizado parcialmente
  - ✅ Eliminadas referencias a `gestion` y `tipoGestion` en createCausa
  - ✅ Eliminadas referencias a `gestion` y `tipoGestion` en updateCausa
  - ✅ Actualizadas tipologías 3 y 4 a usar IDs
  - ✅ Actualizado select de riesgos para incluir relaciones de tipologías

### Servicios que REQUIEREN REFACTORIZACIÓN COMPLETA
- ⚠️ `services/recalculoResidual.service.ts` - USA INTENSIVAMENTE `gestion` JSONB
- ⚠️ `services/alertas-vencimiento.service.ts` - Lee planes desde `gestion`
- ⚠️ `controllers/plan-trazabilidad.controller.ts` - Gestiona planes en `gestion`

## Estrategia de Migración para Servicios

### Opción 1: Refactorización Completa (RECOMENDADA)
Reescribir los servicios para trabajar directamente con las tablas normalizadas:
- `ControlRiesgo` para datos de controles
- `PlanAccion` para datos de planes
- `HistorialEstadoPlan` para historial
- `EvaluacionRiesgo` para valores residuales

### Opción 2: Capa de Compatibilidad (TEMPORAL)
Crear funciones helper que reconstruyan el objeto `gestion` desde las tablas normalizadas para mantener compatibilidad temporal.

## Decisión: Opción 1 - Refactorización Completa

Los servicios deben ser refactorizados para:

1. **recalculoResidual.service.ts**
   - Leer datos de `ControlRiesgo` en lugar de `CausaRiesgo.gestion`
   - Actualizar `ControlRiesgo` y `EvaluacionRiesgo` directamente
   - Eliminar toda lógica que construye/parsea el objeto JSONB

2. **alertas-vencimiento.service.ts**
   - Leer planes desde tabla `PlanAccion` con `causaRiesgoId`
   - Filtrar por `estado` en lugar de `gestion.planEstado`

3. **plan-trazabilidad.controller.ts**
   - Gestionar estados en tabla `HistorialEstadoPlan`
   - Actualizar `PlanAccion` directamente
   - Eliminar toda manipulación del objeto `gestion`

## Próximos Pasos

1. ✅ Actualizar schema.prisma
2. ✅ Generar migración de Prisma
3. ⏳ Refactorizar recalculoResidual.service.ts
4. ⏳ Refactorizar alertas-vencimiento.service.ts
5. ⏳ Refactorizar plan-trazabilidad.controller.ts
6. ⏳ Actualizar referencias en procesos.controller.ts (Usuario.role)
7. ⏳ Actualizar referencias en audit.middleware.ts (Usuario.role)
8. ⏳ Crear endpoints CRUD para TipologiaRiesgoExtendida
9. ⏳ Probar todos los endpoints afectados
10. ⏳ Actualizar documentación

## Notas Importantes

- La migración SQL debe ejecutarse ANTES de desplegar el código actualizado
- Los datos ya fueron migrados, el código solo necesita adaptarse
- Mantener compatibilidad con frontend durante la transición
- Considerar crear índices adicionales si el rendimiento se degrada
