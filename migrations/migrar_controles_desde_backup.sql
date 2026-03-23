-- =====================================================
-- MIGRAR CONTROLES DESDE BACKUP A BASE ACTUAL
-- =====================================================
-- Este script migra los controles desde temp_backup_pre_migracion
-- a la base de datos actual (riesgosdb)
-- 
-- PREREQUISITOS:
-- 1. Tener ambas bases de datos disponibles
-- 2. Ejecutar desde la base de datos ACTUAL (riesgosdb)
-- 3. Tener permisos para acceder a temp_backup_pre_migracion
-- =====================================================

-- PASO 1: Verificar conexión y contar controles en backup
-- (Ejecutar en temp_backup_pre_migracion)
SELECT 
    'temp_backup_pre_migracion' as base_datos,
    COUNT(*) as total_controles
FROM "CausaRiesgo"
WHERE "tipoGestion" IN ('CONTROL', 'AMBOS');

-- PASO 2: Ver ejemplos de controles a migrar
-- (Ejecutar en temp_backup_pre_migracion)
SELECT 
    id as causa_id,
    "riesgoId",
    descripcion as causa_descripcion,
    "controlDescripcion",
    aplicabilidad,
    cobertura,
    facilidadUso,
    segregacion,
    naturaleza,
    desviaciones,
    "puntajeTotal",
    "evaluacionDefinitiva",
    "tipoMitigacion"
FROM "CausaRiesgo"
WHERE "tipoGestion" IN ('CONTROL', 'AMBOS')
LIMIT 5;

-- PASO 3: Verificar que las causas existen en la base actual
-- (Ejecutar en riesgosdb - base actual)
SELECT 
    COUNT(*) as causas_en_base_actual
FROM "CausaRiesgo";

-- PASO 4: Verificar estado actual de ControlRiesgo
-- (Ejecutar en riesgosdb - base actual)
SELECT 
    COUNT(*) as controles_actuales
FROM "ControlRiesgo";

-- =====================================================
-- MIGRACIÓN REAL - EJECUTAR SOLO DESPUÉS DE VERIFICAR
-- =====================================================

-- PASO 5: Insertar controles desde backup a base actual
-- IMPORTANTE: Ajustar el nombre de la base de datos de backup si es diferente
-- (Ejecutar en riesgosdb - base actual)

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
    backup.id as "causaRiesgoId",
    backup."controlDescripcion" as descripcion,
    'PREVENTIVO' as "tipoControl", -- Valor por defecto, ajustar según necesidad
    backup.responsable,
    CASE 
        WHEN backup.aplicabilidad = 'totalmente' THEN 100
        WHEN backup.aplicabilidad = 'parcialmente' THEN 50
        ELSE 0
    END as aplicabilidad,
    CASE 
        WHEN backup.cobertura = 'total' THEN 100
        WHEN backup.cobertura = 'parcial' THEN 50
        ELSE 0
    END as cobertura,
    CASE 
        WHEN backup."facilidadUso" = 'coherente' THEN 100
        WHEN backup."facilidadUso" = 'medianamente' THEN 50
        ELSE 0
    END as "facilidadUso",
    CASE 
        WHEN backup.segregacion = 'si' THEN 100
        WHEN backup.segregacion = 'no' THEN 0
        ELSE 0
    END as segregacion,
    CASE 
        WHEN backup.naturaleza = 'automatico' THEN 100
        WHEN backup.naturaleza = 'semiautomatico' THEN 60
        WHEN backup.naturaleza = 'manual' THEN 30
        ELSE 0
    END as naturaleza,
    CASE 
        WHEN backup.desviaciones = 'A' THEN 100
        WHEN backup.desviaciones = 'B' THEN 75
        WHEN backup.desviaciones = 'C' THEN 50
        WHEN backup.desviaciones = 'D' THEN 25
        ELSE 0
    END as desviaciones,
    backup."puntajeTotal" as "puntajeControl",
    backup."evaluacionPreliminar",
    backup."evaluacionDefinitiva",
    ROUND((backup."porcentajeMitigacion" * 100)::numeric, 0)::integer as "estandarizacionPorcentajeMitigacion",
    backup."tipoMitigacion" as "disminuyeFrecuenciaImpactoAmbas",
    backup."descripcionControl",
    backup.recomendacion,
    backup."tipoMitigacion",
    CASE 
        WHEN backup."tipoGestion" = 'AMBOS' THEN 'ACTIVO'
        ELSE NULL
    END as "estadoAmbos",
    backup."recalculadoEn"
FROM dblink(
    'dbname=temp_backup_pre_migracion',
    'SELECT 
        id,
        "controlDescripcion",
        responsable,
        aplicabilidad,
        cobertura,
        "facilidadUso",
        segregacion,
        naturaleza,
        desviaciones,
        "puntajeTotal",
        "evaluacionPreliminar",
        "evaluacionDefinitiva",
        "porcentajeMitigacion",
        "tipoMitigacion",
        "descripcionControl",
        recomendacion,
        "tipoGestion",
        "recalculadoEn"
    FROM "CausaRiesgo"
    WHERE "tipoGestion" IN (''CONTROL'', ''AMBOS'')
    AND "controlDescripcion" IS NOT NULL'
) AS backup(
    id integer,
    "controlDescripcion" text,
    responsable text,
    aplicabilidad text,
    cobertura text,
    "facilidadUso" text,
    segregacion text,
    naturaleza text,
    desviaciones text,
    "puntajeTotal" integer,
    "evaluacionPreliminar" text,
    "evaluacionDefinitiva" text,
    "porcentajeMitigacion" numeric,
    "tipoMitigacion" text,
    "descripcionControl" text,
    recomendacion text,
    "tipoGestion" text,
    "recalculadoEn" timestamp
)
INNER JOIN "CausaRiesgo" actual ON actual.id = backup.id
WHERE NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" 
    WHERE "causaRiesgoId" = backup.id
);

-- PASO 6: Verificar resultados
SELECT 
    COUNT(*) as controles_migrados
FROM "ControlRiesgo";

-- PASO 7: Ver ejemplos de controles migrados
SELECT 
    cr.id,
    cr."causaRiesgoId",
    cr.descripcion,
    cr."puntajeControl",
    cr."evaluacionDefinitiva",
    causa.descripcion as causa_descripcion
FROM "ControlRiesgo" cr
INNER JOIN "CausaRiesgo" causa ON causa.id = cr."causaRiesgoId"
LIMIT 10;
