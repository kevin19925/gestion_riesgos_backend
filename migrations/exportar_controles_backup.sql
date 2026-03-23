-- =====================================================
-- EXPORTAR CONTROLES DESDE BACKUP
-- =====================================================
-- Ejecutar en: temp_backup_pre_migracion (o postgres si ese es el nombre)
-- =====================================================

-- PASO 1: Contar controles disponibles
SELECT 
    "tipoGestion",
    COUNT(*) as cantidad
FROM "CausaRiesgo"
WHERE "tipoGestion" IN ('CONTROL', 'AMBOS')
GROUP BY "tipoGestion";

-- PASO 2: Ver ejemplos de controles
SELECT 
    id,
    "riesgoId",
    descripcion,
    "tipoGestion",
    coalesce("puntajeTotal", 0) as puntaje,
    "evaluacionDefinitiva"
FROM "CausaRiesgo"
WHERE "tipoGestion" IN ('CONTROL', 'AMBOS')
LIMIT 5;

-- PASO 3: Exportar controles a CSV extrayendo datos del JSONB
-- IMPORTANTE: Ajustar la ruta según tu sistema
-- Windows: 'C:/temp/controles_backup.csv'
-- Crear la carpeta C:/temp antes si no existe

COPY (
    SELECT 
        id as causa_id,
        "riesgoId",
        descripcion as causa_descripcion,
        gestion->>'controlDescripcion' as control_descripcion,
        gestion->>'responsable' as responsable,
        gestion->>'aplicabilidad' as aplicabilidad,
        gestion->>'cobertura' as cobertura,
        gestion->>'facilidadUso' as facilidad_uso,
        gestion->>'segregacion' as segregacion,
        gestion->>'naturaleza' as naturaleza,
        gestion->>'desviaciones' as desviaciones,
        (gestion->>'puntajeTotal')::numeric as puntaje_total,
        gestion->>'evaluacionPreliminar' as evaluacion_preliminar,
        gestion->>'evaluacionDefinitiva' as evaluacion_definitiva,
        (gestion->>'porcentajeMitigacion')::numeric as porcentaje_mitigacion,
        gestion->>'tipoMitigacion' as tipo_mitigacion,
        gestion->>'descripcionControl' as descripcion_control,
        gestion->>'recomendacion' as recomendacion,
        "tipoGestion",
        (gestion->>'recalculadoEn')::timestamp as recalculado_en
    FROM "CausaRiesgo"
    WHERE "tipoGestion" IN ('CONTROL', 'AMBOS')
    AND gestion IS NOT NULL
    ORDER BY id
) TO 'C:/temp/controles_backup.csv' WITH CSV HEADER;

-- Si da error de permisos, usar esta ruta alternativa:
-- TO 'C:/Users/TuUsuario/Desktop/controles_backup.csv' WITH CSV HEADER;
