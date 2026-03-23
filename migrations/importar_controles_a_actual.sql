-- =====================================================
-- IMPORTAR CONTROLES A BASE ACTUAL
-- =====================================================
-- Ejecutar en: riesgosdb (base de datos actual)
-- Prerequisito: Haber ejecutado exportar_controles_backup.sql
-- =====================================================

-- PASO 1: Verificar estado actual
SELECT 
    'CausaRiesgo' as tabla,
    COUNT(*) as total
FROM "CausaRiesgo"
UNION ALL
SELECT 
    'ControlRiesgo' as tabla,
    COUNT(*) as total
FROM "ControlRiesgo";

-- PASO 2: Crear tabla temporal
DROP TABLE IF EXISTS temp_controles_backup;

CREATE TEMP TABLE temp_controles_backup (
    causa_id integer,
    riesgo_id integer,
    causa_descripcion text,
    control_descripcion text,
    responsable text,
    aplicabilidad text,
    cobertura text,
    facilidad_uso text,
    segregacion text,
    naturaleza text,
    desviaciones text,
    puntaje_total numeric,
    evaluacion_preliminar text,
    evaluacion_definitiva text,
    porcentaje_mitigacion numeric,
    tipo_mitigacion text,
    descripcion_control text,
    recomendacion text,
    tipo_gestion text,
    recalculado_en timestamp
);

-- PASO 3: Importar CSV
-- IMPORTANTE: Ajustar la ruta al archivo exportado
COPY temp_controles_backup 
FROM 'C:/temp/controles_backup.csv' 
WITH CSV HEADER;

-- Si usaste otra ruta, ajustar:
-- FROM 'C:/Users/TuUsuario/Desktop/controles_backup.csv' WITH CSV HEADER;

-- PASO 4: Verificar importación
SELECT 
    COUNT(*) as total_importados,
    COUNT(DISTINCT causa_id) as causas_unicas,
    COUNT(DISTINCT riesgo_id) as riesgos_unicos
FROM temp_controles_backup;

-- PASO 5: Ver ejemplos importados
SELECT * FROM temp_controles_backup LIMIT 5;

-- PASO 6: Verificar que las causas existen en la base actual
SELECT 
    COUNT(*) as causas_que_existen
FROM temp_controles_backup temp
INNER JOIN "CausaRiesgo" causa ON causa.id = temp.causa_id;

SELECT 
    COUNT(*) as causas_que_NO_existen
FROM temp_controles_backup temp
LEFT JOIN "CausaRiesgo" causa ON causa.id = temp.causa_id
WHERE causa.id IS NULL;

-- PASO 7: Migrar a ControlRiesgo
INSERT INTO "ControlRiesgo" (
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    responsable,
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
    "disminuyeFrecuenciaImpactoAmbas",
    "descripcionControl",
    recomendacion,
    "tipoMitigacion",
    "estadoAmbos",
    "recalculadoEn"
)
SELECT 
    temp.causa_id as "causaRiesgoId",
    temp.control_descripcion as descripcion,
    'PREVENTIVO' as "tipoControl",
    temp.responsable,
    -- Convertir valores textuales a numéricos
    CASE 
        WHEN temp.aplicabilidad = 'totalmente' THEN 100
        WHEN temp.aplicabilidad = 'parcialmente' THEN 50
        ELSE 0
    END as aplicabilidad,
    CASE 
        WHEN temp.cobertura = 'total' THEN 100
        WHEN temp.cobertura = 'parcial' THEN 50
        ELSE 0
    END as cobertura,
    CASE 
        WHEN temp.facilidad_uso = 'coherente' THEN 100
        WHEN temp.facilidad_uso = 'medianamente' THEN 50
        ELSE 0
    END as "facilidadUso",
    CASE 
        WHEN temp.segregacion = 'si' THEN 100
        WHEN temp.segregacion = 'no' THEN 0
        ELSE 0
    END as segregacion,
    CASE 
        WHEN temp.naturaleza = 'automatico' THEN 100
        WHEN temp.naturaleza = 'semiautomatico' THEN 60
        WHEN temp.naturaleza = 'manual' THEN 30
        ELSE 0
    END as naturaleza,
    CASE 
        WHEN temp.desviaciones = 'A' THEN 100
        WHEN temp.desviaciones = 'B' THEN 75
        WHEN temp.desviaciones = 'C' THEN 50
        WHEN temp.desviaciones = 'D' THEN 25
        ELSE 0
    END as desviaciones,
    temp.puntaje_total::integer as "puntajeControl",
    temp.evaluacion_preliminar,
    temp.evaluacion_definitiva,
    ROUND((COALESCE(temp.porcentaje_mitigacion, 0) * 100)::numeric, 0)::integer as "estandarizacionPorcentajeMitigacion",
    temp.tipo_mitigacion as "disminuyeFrecuenciaImpactoAmbas",
    temp.descripcion_control,
    temp.recomendacion,
    temp.tipo_mitigacion,
    CASE 
        WHEN temp.tipo_gestion = 'AMBOS' THEN 'ACTIVO'
        ELSE NULL
    END as "estadoAmbos",
    temp.recalculado_en
FROM temp_controles_backup temp
INNER JOIN "CausaRiesgo" causa ON causa.id = temp.causa_id
WHERE NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" 
    WHERE "causaRiesgoId" = temp.causa_id
);

-- PASO 8: Verificar migración
SELECT 
    COUNT(*) as controles_migrados
FROM "ControlRiesgo";

-- PASO 9: Ver ejemplos de controles migrados
SELECT 
    cr.id,
    cr."causaRiesgoId",
    cr.descripcion,
    cr."puntajeControl",
    cr."evaluacionDefinitiva",
    cr.aplicabilidad,
    cr.cobertura,
    causa.descripcion as causa_descripcion
FROM "ControlRiesgo" cr
INNER JOIN "CausaRiesgo" causa ON causa.id = cr."causaRiesgoId"
ORDER BY cr.id
LIMIT 10;

-- PASO 10: Verificar controles por riesgo
SELECT 
    r.id as riesgo_id,
    r."numeroIdentificacion",
    r.descripcion as riesgo,
    COUNT(DISTINCT causa.id) as num_causas,
    COUNT(DISTINCT cr.id) as num_controles
FROM "Riesgo" r
INNER JOIN "CausaRiesgo" causa ON causa."riesgoId" = r.id
LEFT JOIN "ControlRiesgo" cr ON cr."causaRiesgoId" = causa.id
GROUP BY r.id, r."numeroIdentificacion", r.descripcion
HAVING COUNT(DISTINCT cr.id) > 0
ORDER BY num_controles DESC
LIMIT 10;

-- PASO 11: Limpiar tabla temporal (opcional)
-- DROP TABLE IF EXISTS temp_controles_backup;
