-- =====================================================
-- ¡ENCONTRADO! Los planes están en CausaRiesgo.gestion
-- =====================================================

-- Los "Planes de Acción" que ves en la pantalla NO están en la tabla PlanAccion
-- Están guardados como JSON en el campo "gestion" de la tabla CausaRiesgo

-- PASO 1: Ver el campo gestion del riesgo 146
SELECT 
    cr.id,
    cr."riesgoId",
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    cr.gestion,  -- ⭐ AQUÍ ESTÁN LOS DATOS DEL PLAN
    cr."createdAt"
FROM "CausaRiesgo" cr
WHERE cr."riesgoId" = 146
ORDER BY cr.id;

-- PASO 2: Extraer datos específicos del plan desde el JSON
SELECT 
    cr.id,
    cr."riesgoId",
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    -- Extraer campos del JSON gestion
    cr.gestion->>'planDescripcion' as plan_descripcion,
    cr.gestion->>'planResponsable' as plan_responsable,
    cr.gestion->>'planFechaEstimada' as plan_fecha_estimada,
    cr.gestion->>'planEstado' as plan_estado,
    cr.gestion->>'planDetalle' as plan_detalle,
    cr.gestion->>'planDecision' as plan_decision
FROM "CausaRiesgo" cr
WHERE cr."riesgoId" = 146
  AND cr.gestion IS NOT NULL
ORDER BY cr.id;

-- PASO 3: Buscar TODAS las causas que tienen planes (cualquier riesgo)
SELECT 
    cr.id,
    cr."riesgoId",
    r."numeroIdentificacion" as riesgo_numero,
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    cr.gestion->>'planDescripcion' as plan_descripcion,
    cr.gestion->>'planResponsable' as plan_responsable,
    cr.gestion->>'planFechaEstimada' as plan_fecha_estimada,
    cr.gestion->>'planEstado' as plan_estado
FROM "CausaRiesgo" cr
LEFT JOIN "Riesgo" r ON r.id = cr."riesgoId"
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
   OR cr.gestion->>'planDescripcion' IS NOT NULL
ORDER BY cr."riesgoId", cr.id
LIMIT 20;

-- PASO 4: Contar cuántos planes hay realmente
SELECT 
    COUNT(*) as total_causas_con_plan,
    COUNT(CASE WHEN cr."tipoGestion" = 'PLAN' THEN 1 END) as tipo_plan,
    COUNT(CASE WHEN cr."tipoGestion" = 'AMBOS' THEN 1 END) as tipo_ambos,
    COUNT(CASE WHEN cr.gestion->>'planDescripcion' IS NOT NULL THEN 1 END) as con_plan_descripcion
FROM "CausaRiesgo" cr
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
   OR cr.gestion->>'planDescripcion' IS NOT NULL;

-- PASO 5: Ver estructura completa del campo gestion
SELECT 
    cr.id,
    cr."riesgoId",
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    jsonb_pretty(cr.gestion::jsonb) as gestion_formateado
FROM "CausaRiesgo" cr
WHERE cr."riesgoId" = 146
  AND cr.gestion IS NOT NULL
LIMIT 1;

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

/*
HALLAZGO IMPORTANTE:

Los "Planes de Acción" que ves en la pantalla están guardados en:
- Tabla: CausaRiesgo
- Campo: gestion (tipo JSON)
- Estructura del JSON:
  {
    "planDescripcion": "La Contadora creará y socializará la política...",
    "planResponsable": "Contadora",
    "planFechaEstimada": "2026-07-28",
    "planEstado": "pendiente",
    "planDetalle": "...",
    "planDecision": "...",
    "tipoGestion": "PLAN" o "AMBOS"
  }

La tabla PlanAccion existe pero NO se está usando actualmente.

IMPLICACIONES PARA LA MIGRACIÓN:

1. ✅ La tabla PlanAccion está vacía (correcto)
2. ✅ Los datos reales están en CausaRiesgo.gestion
3. ⚠️ Necesitamos decidir:
   
   OPCIÓN A: Migrar datos de CausaRiesgo.gestion → PlanAccion
   - Extraer todos los planes del JSON
   - Crear registros en PlanAccion
   - Mantener referencia en CausaRiesgo
   
   OPCIÓN B: Mantener datos en CausaRiesgo.gestion
   - No migrar nada
   - Aplicar campos de trazabilidad solo a PlanAccion
   - Usar PlanAccion para nuevos planes
   - Mantener planes legacy en CausaRiesgo.gestion
   
   OPCIÓN C: Híbrido
   - Migrar planes importantes a PlanAccion
   - Mantener histórico en CausaRiesgo.gestion
   - Nuevos planes solo en PlanAccion

RECOMENDACIÓN:
Opción B es la más segura para empezar:
- No tocamos datos existentes
- Aplicamos la migración de schema
- Los nuevos planes usan PlanAccion con trazabilidad
- Los planes legacy siguen funcionando
*/
