-- Diagnóstico de Datos Actuales
-- Verificar qué datos existen en las tablas

-- 1. Ver estructura de CausaRiesgo
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;

-- 2. Contar registros en cada tabla
SELECT 'CausaRiesgo' as tabla, COUNT(*) as total FROM "CausaRiesgo"
UNION ALL
SELECT 'ControlRiesgo' as tabla, COUNT(*) as total FROM "ControlRiesgo"
UNION ALL
SELECT 'PlanAccion' as tabla, COUNT(*) as total FROM "PlanAccion";

-- 3. Ver ejemplos de causas
SELECT 
    id,
    "riesgoId",
    descripcion,
    "fuenteCausa",
    frecuencia
FROM "CausaRiesgo"
LIMIT 5;

-- 4. Verificar si hay controles
SELECT 
    id,
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    "puntajeControl"
FROM "ControlRiesgo"
LIMIT 5;

-- 5. Verificar si hay planes
SELECT 
    id,
    "causaRiesgoId",
    descripcion,
    estado,
    "tipoGestion"
FROM "PlanAccion"
LIMIT 5;

-- 6. Ver causas con sus relaciones
SELECT 
    cr.id as causa_id,
    cr.descripcion as causa,
    COUNT(DISTINCT ctrl.id) as num_controles,
    COUNT(DISTINCT pa.id) as num_planes
FROM "CausaRiesgo" cr
LEFT JOIN "ControlRiesgo" ctrl ON ctrl."causaRiesgoId" = cr.id
LEFT JOIN "PlanAccion" pa ON pa."causaRiesgoId" = cr.id
GROUP BY cr.id, cr.descripcion
HAVING COUNT(DISTINCT ctrl.id) > 0 OR COUNT(DISTINCT pa.id) > 0
LIMIT 10;

-- 7. Ver riesgos del proceso "Gestión de TI"
SELECT 
    r.id,
    r."numeroIdentificacion",
    r.descripcion,
    p.nombre as proceso,
    COUNT(DISTINCT cr.id) as num_causas
FROM "Riesgo" r
INNER JOIN "Proceso" p ON p.id = r."procesoId"
LEFT JOIN "CausaRiesgo" cr ON cr."riesgoId" = r.id
WHERE p.nombre LIKE '%TI%' OR p.sigla LIKE '%TI%'
GROUP BY r.id, r."numeroIdentificacion", r.descripcion, p.nombre
LIMIT 10;
