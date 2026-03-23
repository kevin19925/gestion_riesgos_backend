-- =====================================================
-- BUSCAR DÓNDE ESTÁN LOS PLANES DE ACCIÓN REALMENTE
-- Ya sabemos que el riesgo es ID 146
-- =====================================================

-- PASO 1: Buscar en PriorizacionRiesgo (puede tener planes embebidos)
SELECT 
    pr.id,
    pr."riesgoId",
    pr."calificacionFinal",
    pr.respuesta,
    pr.responsable,
    pr."puntajePriorizacion",
    pr."fechaAsignacion"
FROM "PriorizacionRiesgo" pr
WHERE pr."riesgoId" = 146;

-- PASO 2: Buscar planes vinculados a priorizacion
SELECT 
    pa.id,
    pa."priorizacionId",
    pa."riesgoId",
    pa."causaRiesgoId",
    pa.nombre,
    pa.descripcion,
    pa.responsable,
    pa."fechaProgramada",
    pa.estado,
    pa."porcentajeAvance"
FROM "PlanAccion" pa
WHERE pa."priorizacionId" IN (
    SELECT id FROM "PriorizacionRiesgo" WHERE "riesgoId" = 146
);

-- PASO 3: Buscar planes vinculados a causas del riesgo 146
SELECT 
    pa.id,
    pa."causaRiesgoId",
    pa."riesgoId",
    pa.descripcion as plan_descripcion,
    pa.responsable,
    pa."fechaProgramada",
    pa.estado,
    cr.id as causa_id,
    cr.descripcion as causa_descripcion
FROM "PlanAccion" pa
INNER JOIN "CausaRiesgo" cr ON cr.id = pa."causaRiesgoId"
WHERE cr."riesgoId" = 146;

-- PASO 4: Buscar TODOS los planes (sin filtro) para ver si existen datos
SELECT 
    COUNT(*) as total_planes,
    COUNT(CASE WHEN "riesgoId" IS NOT NULL THEN 1 END) as con_riesgo,
    COUNT(CASE WHEN "causaRiesgoId" IS NOT NULL THEN 1 END) as con_causa,
    COUNT(CASE WHEN "priorizacionId" IS NOT NULL THEN 1 END) as con_priorizacion,
    COUNT(CASE WHEN "incidenciaId" IS NOT NULL THEN 1 END) as con_incidencia
FROM "PlanAccion";

-- PASO 5: Ver ejemplos de planes que SÍ existen (cualquier riesgo)
SELECT 
    pa.id,
    pa."riesgoId",
    pa."causaRiesgoId",
    pa.descripcion,
    pa.responsable,
    pa.estado,
    r."numeroIdentificacion" as riesgo_numero
FROM "PlanAccion" pa
LEFT JOIN "Riesgo" r ON r.id = pa."riesgoId"
ORDER BY pa.id DESC
LIMIT 10;

-- PASO 6: Buscar en tabla de gestión (si existe una tabla intermedia)
-- Verificar si existe una tabla de gestión de planes
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND (
        LOWER(table_name) LIKE '%gestion%'
        OR LOWER(table_name) LIKE '%plan%'
        OR LOWER(table_name) LIKE '%accion%'
    )
ORDER BY table_name;

-- PASO 7: Buscar en ControlRiesgo (a veces los "planes" están como controles)
SELECT 
    cr.id,
    cr."causaRiesgoId",
    cr.descripcion,
    cr."tipoControl",
    cr.responsable,
    cr."puntajeControl",
    causa.descripcion as causa_descripcion
FROM "ControlRiesgo" cr
INNER JOIN "CausaRiesgo" causa ON causa.id = cr."causaRiesgoId"
WHERE causa."riesgoId" = 146
ORDER BY cr.id;

-- PASO 8: Verificar si los planes están en un campo JSON
-- Buscar en la tabla Riesgo si tiene un campo JSON con planes
SELECT 
    id,
    "numeroIdentificacion",
    descripcion
FROM "Riesgo"
WHERE id = 146;

-- PASO 9: Buscar en PriorizacionRiesgo si tiene planes en JSON
SELECT 
    pr.id,
    pr."riesgoId",
    pr.respuesta,
    pr.responsable
FROM "PriorizacionRiesgo" pr
WHERE pr."riesgoId" = 146;

-- PASO 10: Ver estructura completa de PlanAccion
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'PlanAccion'
ORDER BY ordinal_position;

-- =====================================================
-- INTERPRETACIÓN
-- =====================================================

/*
PASO 1-2: Busca si hay priorizacion y planes vinculados
PASO 3: Busca planes vinculados a las causas que encontraste
PASO 4: Cuenta total de planes en la BD
PASO 5: Muestra ejemplos de planes que SÍ existen
PASO 6: Lista tablas relacionadas con planes
PASO 7: Verifica si los "planes" están en ControlRiesgo
PASO 8-9: Verifica si hay datos en campos JSON
PASO 10: Muestra estructura de PlanAccion

POSIBLES ESCENARIOS:

1. Si PASO 4 muestra total_planes = 0:
   → La tabla PlanAccion existe pero está completamente vacía
   → Los datos están en otra tabla o en JSON

2. Si PASO 5 muestra datos:
   → Hay planes en la BD, pero no para el riesgo 146
   → El riesgo 146 no tiene planes creados aún

3. Si PASO 7 muestra datos:
   → Los "planes" que ves en pantalla son en realidad ControlRiesgo
   → El frontend está mostrando ControlRiesgo como si fueran planes

4. Si PASO 3 muestra datos:
   → Los planes están vinculados a causas específicas
   → Necesitas buscar por causaRiesgoId
*/
