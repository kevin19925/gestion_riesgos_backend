-- Diagnóstico de Controles
-- Verificar si hay controles en la base de datos

-- 1. Contar controles en ControlRiesgo
SELECT 
    'ControlRiesgo' as tabla,
    COUNT(*) as total_registros
FROM "ControlRiesgo";

-- 2. Ver algunos controles de ejemplo
SELECT 
    id,
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    "puntajeControl",
    "evaluacionDefinitiva"
FROM "ControlRiesgo"
LIMIT 5;

-- 3. Verificar causas con controles
SELECT 
    cr.id as causa_id,
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    COUNT(ctrl.id) as num_controles
FROM "CausaRiesgo" cr
LEFT JOIN "ControlRiesgo" ctrl ON ctrl."causaRiesgoId" = cr.id
GROUP BY cr.id, cr.descripcion, cr."tipoGestion"
HAVING COUNT(ctrl.id) > 0
LIMIT 10;

-- 4. Verificar riesgos del proceso "Gestión de TI"
SELECT 
    r.id as riesgo_id,
    r."numeroIdentificacion",
    r.descripcion as riesgo_descripcion,
    p.nombre as proceso,
    COUNT(DISTINCT cr.id) as num_causas,
    COUNT(DISTINCT ctrl.id) as num_controles
FROM "Riesgo" r
INNER JOIN "Proceso" p ON p.id = r."procesoId"
LEFT JOIN "CausaRiesgo" cr ON cr."riesgoId" = r.id
LEFT JOIN "ControlRiesgo" ctrl ON ctrl."causaRiesgoId" = cr.id
WHERE p.nombre LIKE '%TI%' OR p.nombre LIKE '%Gestión de TI%'
GROUP BY r.id, r."numeroIdentificacion", r.descripcion, p.nombre
ORDER BY r.id;

-- 5. Ver detalle de una causa con control
SELECT 
    cr.id as causa_id,
    cr.descripcion as causa,
    cr."tipoGestion",
    ctrl.id as control_id,
    ctrl.descripcion as control_descripcion,
    ctrl."tipoControl",
    ctrl."puntajeControl"
FROM "CausaRiesgo" cr
INNER JOIN "ControlRiesgo" ctrl ON ctrl."causaRiesgoId" = cr.id
LIMIT 5;

-- 6. Verificar si hay causas con puntajeTotal (legacy)
SELECT 
    id,
    descripcion,
    "tipoGestion",
    "puntajeTotal",
    "evaluacionDefinitiva"
FROM "CausaRiesgo"
WHERE "puntajeTotal" IS NOT NULL
LIMIT 5;
