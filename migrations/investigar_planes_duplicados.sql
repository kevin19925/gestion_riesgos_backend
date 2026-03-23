-- Investigar planes duplicados
-- Buscar el riesgo 2GTI y sus causas con planes

-- 1. Buscar el riesgo 2GTI
SELECT 
    r.id as riesgo_id,
    r."numeroIdentificacion",
    r.descripcion as riesgo_descripcion,
    r."procesoId"
FROM "Riesgo" r
WHERE r."numeroIdentificacion" = '2GTI';

-- 2. Buscar todas las causas de ese riesgo que tienen planes
SELECT 
    c.id as causa_id,
    c."riesgoId",
    c.descripcion as causa_descripcion,
    c."tipoGestion",
    c.gestion::text as gestion_json
FROM "CausaRiesgo" c
WHERE c."riesgoId" IN (
    SELECT id FROM "Riesgo" WHERE "numeroIdentificacion" = '2GTI'
)
AND c."tipoGestion" IN ('PLAN', 'AMBOS')
ORDER BY c.id;

-- 3. Extraer solo los datos del plan de cada causa
SELECT 
    c.id as causa_id,
    c.descripcion as causa_descripcion,
    c.gestion->>'planDescripcion' as plan_descripcion,
    c.gestion->>'planResponsable' as plan_responsable,
    c.gestion->>'planFechaEstimada' as plan_fecha,
    c.gestion->>'planDetalle' as plan_detalle,
    c.gestion->>'planEstado' as plan_estado
FROM "CausaRiesgo" c
WHERE c."riesgoId" IN (
    SELECT id FROM "Riesgo" WHERE "numeroIdentificacion" = '2GTI'
)
AND c."tipoGestion" IN ('PLAN', 'AMBOS')
ORDER BY c.id;

-- 4. Contar cuántas causas tienen el mismo plan
SELECT 
    c.gestion->>'planDescripcion' as plan_descripcion,
    COUNT(*) as cantidad_causas,
    array_agg(c.id) as causa_ids
FROM "CausaRiesgo" c
WHERE c."riesgoId" IN (
    SELECT id FROM "Riesgo" WHERE "numeroIdentificacion" = '2GTI'
)
AND c."tipoGestion" IN ('PLAN', 'AMBOS')
GROUP BY c.gestion->>'planDescripcion'
HAVING COUNT(*) > 1;
