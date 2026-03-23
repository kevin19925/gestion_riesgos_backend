-- Migración de Controles Legacy a Tabla ControlRiesgo
-- Este script migra los controles que están en campos legacy de CausaRiesgo
-- a la nueva tabla normalizada ControlRiesgo

-- PASO 1: Verificar cuántas causas tienen datos de control legacy
SELECT 
    COUNT(*) as causas_con_control_legacy,
    COUNT(CASE WHEN "puntajeTotal" IS NOT NULL THEN 1 END) as con_puntaje,
    COUNT(CASE WHEN "evaluacionDefinitiva" IS NOT NULL THEN 1 END) as con_evaluacion,
    COUNT(CASE WHEN "controlDescripcion" IS NOT NULL THEN 1 END) as con_descripcion
FROM "CausaRiesgo"
WHERE "puntajeTotal" IS NOT NULL 
   OR "evaluacionDefinitiva" IS NOT NULL
   OR "controlDescripcion" IS NOT NULL;

-- PASO 2: Ver ejemplos de causas con controles legacy
SELECT 
    id,
    descripcion,
    "puntajeTotal",
    "evaluacionDefinitiva",
    "controlDescripcion",
    "controlTipo"
FROM "CausaRiesgo"
WHERE "puntajeTotal" IS NOT NULL
LIMIT 5;

-- PASO 3: Migrar controles legacy a tabla ControlRiesgo
-- IMPORTANTE: Ejecutar solo si no hay registros en ControlRiesgo
INSERT INTO "ControlRiesgo" (
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    responsable,
    "descripcionControl",
    aplicabilidad,
    cobertura,
    "facilidadUso",
    segregacion,
    naturaleza,
    desviaciones,
    "puntajeControl",
    "evaluacionPreliminar",
    "evaluacionDefinitiva",
    recomendacion,
    "estandarizacionPorcentajeMitigacion",
    "createdAt",
    "updatedAt"
)
SELECT 
    cr.id as "causaRiesgoId",
    COALESCE(cr."controlDescripcion", cr.descripcion, 'Control migrado') as descripcion,
    COALESCE(cr."controlTipo", 'prevención') as "tipoControl",
    COALESCE(cr."controlResponsable", 'Sin asignar') as responsable,
    COALESCE(cr."controlDescripcion", cr.descripcion, 'Control migrado desde campos legacy') as "descripcionControl",
    COALESCE(cr.aplicabilidad, 3) as aplicabilidad,
    COALESCE(cr.cobertura, 3) as cobertura,
    COALESCE(cr."facilidadUso", 3) as "facilidadUso",
    COALESCE(cr.segregacion, 3) as segregacion,
    COALESCE(cr.naturaleza, 1) as naturaleza,
    COALESCE(cr.desviaciones, 0) as desviaciones,
    COALESCE(cr."puntajeTotal", 75) as "puntajeControl",
    COALESCE(cr."evaluacionPreliminar", 'Efectivo') as "evaluacionPreliminar",
    COALESCE(cr."evaluacionDefinitiva", 'Efectivo') as "evaluacionDefinitiva",
    cr.recomendacion as recomendacion,
    COALESCE(cr."porcentajeMitigacion", 0) as "estandarizacionPorcentajeMitigacion",
    COALESCE(cr."createdAt", NOW()) as "createdAt",
    COALESCE(cr."updatedAt", NOW()) as "updatedAt"
FROM "CausaRiesgo" cr
WHERE cr."puntajeTotal" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" ctrl
    WHERE ctrl."causaRiesgoId" = cr.id
  );

-- PASO 4: Actualizar tipoGestion de las causas migradas
UPDATE "CausaRiesgo" cr
SET "tipoGestion" = CASE
    -- Si tiene control Y plan → AMBOS
    WHEN EXISTS (SELECT 1 FROM "ControlRiesgo" ctrl WHERE ctrl."causaRiesgoId" = cr.id)
     AND EXISTS (SELECT 1 FROM "PlanAccion" pa WHERE pa."causaRiesgoId" = cr.id)
    THEN 'AMBOS'
    -- Si solo tiene control → CONTROL
    WHEN EXISTS (SELECT 1 FROM "ControlRiesgo" ctrl WHERE ctrl."causaRiesgoId" = cr.id)
    THEN 'CONTROL'
    -- Si solo tiene plan → PLAN
    WHEN EXISTS (SELECT 1 FROM "PlanAccion" pa WHERE pa."causaRiesgoId" = cr.id)
    THEN 'PLAN'
    -- Si no tiene nada pero tiene puntajeTotal → CONTROL (legacy)
    WHEN cr."puntajeTotal" IS NOT NULL
    THEN 'CONTROL'
    ELSE cr."tipoGestion"
END
WHERE cr."tipoGestion" IS NULL 
   OR cr."tipoGestion" = '';

-- PASO 5: Verificar resultados de la migración
SELECT 
    'Controles migrados' as descripcion,
    COUNT(*) as total
FROM "ControlRiesgo";

SELECT 
    'Causas con tipoGestion' as descripcion,
    "tipoGestion",
    COUNT(*) as total
FROM "CausaRiesgo"
WHERE "tipoGestion" IS NOT NULL
GROUP BY "tipoGestion"
ORDER BY "tipoGestion";

-- PASO 6: Ver ejemplos de controles migrados
SELECT 
    ctrl.id,
    ctrl."causaRiesgoId",
    ctrl.descripcion,
    ctrl."tipoControl",
    ctrl."puntajeControl",
    ctrl."evaluacionDefinitiva",
    cr.descripcion as causa_descripcion
FROM "ControlRiesgo" ctrl
INNER JOIN "CausaRiesgo" cr ON cr.id = ctrl."causaRiesgoId"
LIMIT 10;
