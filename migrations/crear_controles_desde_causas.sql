-- Crear Controles desde Causas Existentes
-- Este script crea controles básicos para todas las causas que no tienen control

-- PASO 1: Verificar cuántas causas NO tienen control
SELECT 
    COUNT(*) as causas_sin_control
FROM "CausaRiesgo" cr
WHERE NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" ctrl
    WHERE ctrl."causaRiesgoId" = cr.id
);

-- PASO 2: Ver ejemplos de causas sin control
SELECT 
    cr.id,
    cr.descripcion,
    r."numeroIdentificacion" as riesgo_codigo,
    r.descripcion as riesgo_descripcion
FROM "CausaRiesgo" cr
INNER JOIN "Riesgo" r ON r.id = cr."riesgoId"
WHERE NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" ctrl
    WHERE ctrl."causaRiesgoId" = cr.id
)
LIMIT 10;

-- PASO 3: Crear controles básicos para causas sin control
-- IMPORTANTE: Esto crea controles con valores por defecto
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
    "estandarizacionPorcentajeMitigacion",
    "tipoMitigacion"
)
SELECT 
    cr.id as "causaRiesgoId",
    'Control para: ' || SUBSTRING(cr.descripcion, 1, 100) as descripcion,
    'prevención' as "tipoControl",
    'Por asignar' as responsable,
    'Control creado automáticamente para la causa: ' || cr.descripcion as "descripcionControl",
    3 as aplicabilidad,      -- Valor medio
    3 as cobertura,          -- Valor medio
    3 as "facilidadUso",     -- Valor medio
    3 as segregacion,        -- Valor medio
    1 as naturaleza,         -- Manual
    0 as desviaciones,       -- Sin desviaciones
    60 as "puntajeControl",  -- 60% (valor medio-bajo)
    'Por evaluar' as "evaluacionPreliminar",
    'Por evaluar' as "evaluacionDefinitiva",
    0 as "estandarizacionPorcentajeMitigacion",
    'AMBAS' as "tipoMitigacion"
FROM "CausaRiesgo" cr
WHERE NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" ctrl
    WHERE ctrl."causaRiesgoId" = cr.id
);

-- PASO 4: Verificar controles creados
SELECT 
    COUNT(*) as controles_creados
FROM "ControlRiesgo";

-- PASO 5: Ver ejemplos de controles creados
SELECT 
    ctrl.id,
    ctrl."causaRiesgoId",
    ctrl.descripcion,
    ctrl."tipoControl",
    ctrl."puntajeControl",
    cr.descripcion as causa_descripcion
FROM "ControlRiesgo" ctrl
INNER JOIN "CausaRiesgo" cr ON cr.id = ctrl."causaRiesgoId"
LIMIT 10;

-- PASO 6: Ver estadísticas por proceso
SELECT 
    p.nombre as proceso,
    COUNT(DISTINCT r.id) as num_riesgos,
    COUNT(DISTINCT cr.id) as num_causas,
    COUNT(DISTINCT ctrl.id) as num_controles
FROM "Proceso" p
LEFT JOIN "Riesgo" r ON r."procesoId" = p.id
LEFT JOIN "CausaRiesgo" cr ON cr."riesgoId" = r.id
LEFT JOIN "ControlRiesgo" ctrl ON ctrl."causaRiesgoId" = cr.id
GROUP BY p.id, p.nombre
HAVING COUNT(DISTINCT ctrl.id) > 0
ORDER BY p.nombre;
