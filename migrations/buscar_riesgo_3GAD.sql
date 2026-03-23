-- =====================================================
-- BUSCAR RIESGO 3GAD Y SUS DATOS RELACIONADOS
-- Basado en la pantalla que estás viendo
-- =====================================================

-- PASO 1: Buscar el riesgo 3GAD
SELECT 
    id,
    procesoId,
    numero,
    descripcion,
    clasificacion,
    "numeroIdentificacion",
    origen,
    "createdAt"
FROM "Riesgo"
WHERE "numeroIdentificacion" LIKE '%3GAD%'
   OR numero = 3
   OR descripcion LIKE '%fuga%perdida%robo%información%'
ORDER BY id;

-- PASO 2: Buscar el proceso "Gestión de Adquisiciones"
SELECT 
    id,
    nombre,
    sigla,
    descripcion,
    "areaId",
    "responsableId"
FROM "Proceso"
WHERE nombre LIKE '%Adquisiciones%'
   OR nombre LIKE '%Gestión de Adquisiciones%'
ORDER BY id;

-- PASO 3: Buscar el área "Financiera Administrativa"
SELECT 
    id,
    nombre,
    descripcion
FROM "Area"
WHERE nombre LIKE '%Financiera%'
   OR nombre LIKE '%Administrativa%'
ORDER BY id;

-- PASO 4: Buscar causas del riesgo
-- (Reemplaza RIESGO_ID con el ID que encontraste en PASO 1)
SELECT 
    id,
    "riesgoId",
    descripcion,
    "fuenteCausa",
    frecuencia,
    seleccionada
FROM "CausaRiesgo"
WHERE "riesgoId" IN (
    SELECT id FROM "Riesgo" 
    WHERE "numeroIdentificacion" LIKE '%3GAD%' 
       OR descripcion LIKE '%fuga%perdida%robo%información%'
)
ORDER BY id;

-- PASO 5: Buscar planes de acción del riesgo
-- Esta es la tabla que debería tener el plan que ves en pantalla
SELECT 
    pa.id,
    pa."riesgoId",
    pa."causaRiesgoId",
    pa.nombre,
    pa.descripcion,
    pa.responsable,
    pa."fechaProgramada",
    pa.estado,
    pa."porcentajeAvance",
    pa."createdAt",
    r."numeroIdentificacion" as riesgo_numero,
    r.descripcion as riesgo_descripcion
FROM "PlanAccion" pa
LEFT JOIN "Riesgo" r ON r.id = pa."riesgoId"
WHERE pa."riesgoId" IN (
    SELECT id FROM "Riesgo" 
    WHERE "numeroIdentificacion" LIKE '%3GAD%'
       OR descripcion LIKE '%fuga%perdida%robo%información%'
)
ORDER BY pa.id;

-- PASO 6: Buscar controles del riesgo
SELECT 
    c.id,
    c."riesgoId",
    c.descripcion,
    c."tipoControl",
    c.efectividad,
    c."riesgoResidual",
    c."clasificacionResidual",
    c."createdAt",
    r."numeroIdentificacion" as riesgo_numero
FROM "Control" c
LEFT JOIN "Riesgo" r ON r.id = c."riesgoId"
WHERE c."riesgoId" IN (
    SELECT id FROM "Riesgo" 
    WHERE "numeroIdentificacion" LIKE '%3GAD%'
       OR descripcion LIKE '%fuga%perdida%robo%información%'
)
ORDER BY c.id;

-- PASO 7: Buscar controles de riesgo (tabla diferente)
SELECT 
    cr.id,
    cr."causaRiesgoId",
    cr.descripcion,
    cr."tipoControl",
    cr."puntajeControl",
    cr."evaluacionDefinitiva",
    causa.descripcion as causa_descripcion,
    r."numeroIdentificacion" as riesgo_numero
FROM "ControlRiesgo" cr
LEFT JOIN "CausaRiesgo" causa ON causa.id = cr."causaRiesgoId"
LEFT JOIN "Riesgo" r ON r.id = causa."riesgoId"
WHERE causa."riesgoId" IN (
    SELECT id FROM "Riesgo" 
    WHERE "numeroIdentificacion" LIKE '%3GAD%'
       OR descripcion LIKE '%fuga%perdida%robo%información%'
)
ORDER BY cr.id;

-- PASO 8: Resumen completo del riesgo 3GAD
SELECT 
    r.id as riesgo_id,
    r."numeroIdentificacion" as riesgo_numero,
    r.descripcion as riesgo_descripcion,
    p.nombre as proceso_nombre,
    a.nombre as area_nombre,
    (SELECT COUNT(*) FROM "CausaRiesgo" WHERE "riesgoId" = r.id) as total_causas,
    (SELECT COUNT(*) FROM "PlanAccion" WHERE "riesgoId" = r.id) as total_planes,
    (SELECT COUNT(*) FROM "Control" WHERE "riesgoId" = r.id) as total_controles,
    (SELECT COUNT(*) FROM "ControlRiesgo" cr 
     JOIN "CausaRiesgo" ca ON ca.id = cr."causaRiesgoId" 
     WHERE ca."riesgoId" = r.id) as total_controles_riesgo
FROM "Riesgo" r
LEFT JOIN "Proceso" p ON p.id = r."procesoId"
LEFT JOIN "Area" a ON a.id = p."areaId"
WHERE r."numeroIdentificacion" LIKE '%3GAD%'
   OR r.descripcion LIKE '%fuga%perdida%robo%información%'
ORDER BY r.id;

-- =====================================================
-- INTERPRETACIÓN DE RESULTADOS
-- =====================================================

/*
PASO 1-3: Identifican el riesgo, proceso y área
PASO 4: Muestra las causas del riesgo
PASO 5: ⭐ CLAVE - Debe mostrar el plan que ves en pantalla
PASO 6-7: Muestran los controles (pueden estar en 2 tablas diferentes)
PASO 8: Resumen general

SI PASO 5 ESTÁ VACÍO:
- La tabla PlanAccion existe pero no tiene datos para este riesgo
- Los datos podrían estar en otra tabla
- Podría ser un problema de sincronización

SI PASO 5 TIENE DATOS:
- ✅ Perfecto, la tabla existe y tiene datos
- Puedes proceder con la migración
- Los datos están donde deben estar
*/
