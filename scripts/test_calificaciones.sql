-- ============================================
-- SCRIPT DE PRUEBA: Verificar Calificaciones de Riesgos
-- Este script muestra el estado actual de las calificaciones
-- ============================================

-- 1. Verificar riesgos con sus evaluaciones y calificaciones
SELECT 
    r.id AS riesgo_id,
    r."numero" AS numero_riesgo,
    r."siglaGerencia" AS sigla,
    -- En la base la columna se llama "descripcion", no "descripcionRiesgo"
    r."descripcion" AS descripcion,
    r."procesoId",
    e."riesgoInherente",
    e."nivelRiesgo",
    e."probabilidad",
    e."impactoGlobal",
    (e."probabilidad" * e."impactoGlobal") AS valor_calculado,
    CASE 
        WHEN e."probabilidad" = 2 AND e."impactoGlobal" = 2 THEN 3.99
        ELSE e."probabilidad" * e."impactoGlobal"
    END AS valor_real_celda
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
ORDER BY r.id;

-- 2. Contar riesgos por nivel
SELECT 
    COALESCE(e."nivelRiesgo", 'Sin Calificar') AS nivel_riesgo,
    COUNT(*) AS cantidad
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
GROUP BY e."nivelRiesgo"
ORDER BY 
    CASE e."nivelRiesgo"
        WHEN 'Crítico' THEN 1
        WHEN 'Alto' THEN 2
        WHEN 'Medio' THEN 3
        WHEN 'Bajo' THEN 4
        ELSE 5
    END;

-- 3. Verificar causas y sus calificaciones
SELECT 
    r.id AS riesgo_id,
    r."numero" AS numero_riesgo,
    c.id AS causa_id,
    c."descripcion" AS causa_descripcion,
    c."frecuencia",
    e."impactoGlobal" AS impacto_global_riesgo,
    CASE 
        WHEN c."frecuencia"::TEXT = '1' THEN 1
        WHEN c."frecuencia"::TEXT = '2' THEN 2
        WHEN c."frecuencia"::TEXT = '3' THEN 3
        WHEN c."frecuencia"::TEXT = '4' THEN 4
        WHEN c."frecuencia"::TEXT = '5' THEN 5
        WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
        WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
        WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
        WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
        WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
        ELSE 3
    END AS frecuencia_num,
    CASE 
        WHEN (CASE 
            WHEN c."frecuencia"::TEXT = '1' THEN 1
            WHEN c."frecuencia"::TEXT = '2' THEN 2
            WHEN c."frecuencia"::TEXT = '3' THEN 3
            WHEN c."frecuencia"::TEXT = '4' THEN 4
            WHEN c."frecuencia"::TEXT = '5' THEN 5
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
            ELSE 3
        END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
        ELSE (CASE 
            WHEN c."frecuencia"::TEXT = '1' THEN 1
            WHEN c."frecuencia"::TEXT = '2' THEN 2
            WHEN c."frecuencia"::TEXT = '3' THEN 3
            WHEN c."frecuencia"::TEXT = '4' THEN 4
            WHEN c."frecuencia"::TEXT = '5' THEN 5
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
            WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
            ELSE 3
        END) * e."impactoGlobal"
    END AS calificacion_inherente_causa
FROM "Riesgo" r
LEFT JOIN "CausaRiesgo" c ON c."riesgoId" = r.id
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
ORDER BY r.id, c.id;

-- 4. Calcular calificación máxima por riesgo (debería coincidir con riesgoInherente)
SELECT 
    r.id AS riesgo_id,
    r."numero" AS numero_riesgo,
    e."riesgoInherente" AS riesgo_inherente_guardado,
    MAX(
        CASE 
            WHEN (CASE 
                WHEN c."frecuencia"::TEXT = '1' THEN 1
                WHEN c."frecuencia"::TEXT = '2' THEN 2
                WHEN c."frecuencia"::TEXT = '3' THEN 3
                WHEN c."frecuencia"::TEXT = '4' THEN 4
                WHEN c."frecuencia"::TEXT = '5' THEN 5
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                ELSE 3
            END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
            ELSE (CASE 
                WHEN c."frecuencia"::TEXT = '1' THEN 1
                WHEN c."frecuencia"::TEXT = '2' THEN 2
                WHEN c."frecuencia"::TEXT = '3' THEN 3
                WHEN c."frecuencia"::TEXT = '4' THEN 4
                WHEN c."frecuencia"::TEXT = '5' THEN 5
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                ELSE 3
            END) * e."impactoGlobal"
        END
    ) AS calificacion_maxima_calculada,
    CASE 
        WHEN MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) >= 15 AND MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) <= 25 THEN 'Crítico'
        WHEN MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) >= 10 AND MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) <= 14 THEN 'Alto'
        WHEN MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) >= 4 AND MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) <= 9 THEN 'Medio'
        WHEN MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) >= 1 AND MAX(
            CASE 
                WHEN (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) = 2 AND e."impactoGlobal" = 2 THEN 3.99
                ELSE (CASE 
                    WHEN c."frecuencia"::TEXT = '1' THEN 1
                    WHEN c."frecuencia"::TEXT = '2' THEN 2
                    WHEN c."frecuencia"::TEXT = '3' THEN 3
                    WHEN c."frecuencia"::TEXT = '4' THEN 4
                    WHEN c."frecuencia"::TEXT = '5' THEN 5
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy baja%' THEN 1
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%baja%' THEN 2
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%media%' OR LOWER(c."frecuencia"::TEXT) LIKE '%moderada%' THEN 3
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%alta%' THEN 4
                    WHEN LOWER(c."frecuencia"::TEXT) LIKE '%muy alta%' THEN 5
                    ELSE 3
                END) * e."impactoGlobal"
            END
        ) <= 3 THEN 'Bajo'
        ELSE 'Sin Calificar'
    END AS nivel_calculado,
    e."nivelRiesgo" AS nivel_guardado
FROM "Riesgo" r
LEFT JOIN "CausaRiesgo" c ON c."riesgoId" = r.id
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
WHERE e.id IS NOT NULL
GROUP BY r.id, r."numero", e."riesgoInherente", e."nivelRiesgo", e."probabilidad", e."impactoGlobal"
ORDER BY r.id;

-- 5. Resumen rápido: Total de riesgos y distribución
SELECT 
    COUNT(DISTINCT r.id) AS total_riesgos,
    COUNT(DISTINCT CASE WHEN e."nivelRiesgo" = 'Crítico' THEN r.id END) AS criticos,
    COUNT(DISTINCT CASE WHEN e."nivelRiesgo" = 'Alto' THEN r.id END) AS altos,
    COUNT(DISTINCT CASE WHEN e."nivelRiesgo" = 'Medio' THEN r.id END) AS medios,
    COUNT(DISTINCT CASE WHEN e."nivelRiesgo" = 'Bajo' THEN r.id END) AS bajos,
    COUNT(DISTINCT CASE WHEN e."nivelRiesgo" IS NULL OR e."nivelRiesgo" = 'Sin Calificar' THEN r.id END) AS sin_calificar
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id;

