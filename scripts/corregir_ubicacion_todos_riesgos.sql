-- Script para corregir automáticamente todos los riesgos con inconsistencias
-- 1. Recalcula riesgoInherente como el máximo de todas las causas
-- 2. Recalcula probabilidad e impactoGlobal desde riesgoInherente (priorizando combinaciones balanceadas)

DO $$
DECLARE
    riesgo_record RECORD;
    calificacion_global_impacto NUMERIC;
    calificacion_inherente_por_causa NUMERIC;
    max_calificacion_inherente NUMERIC;
    riesgo_inherente_actual NUMERIC;
    probabilidad_actual INTEGER;
    impacto_actual INTEGER;
    mejor_prob INTEGER;
    mejor_imp INTEGER;
    valor_calculado NUMERIC;
    encontrado_exacto BOOLEAN;
    menor_diferencia NUMERIC;
    total_riesgos INTEGER := 0;
    riesgos_corregidos INTEGER := 0;
    riesgos_sin_causas INTEGER := 0;
    prob INTEGER;
    imp INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CORRECCIÓN AUTOMÁTICA DE UBICACIÓN DE RIESGOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Iterar sobre todos los riesgos
    FOR riesgo_record IN 
        SELECT 
            r.id as riesgo_id,
            r."numeroIdentificacion",
            er."riesgoInherente",
            er.probabilidad,
            er."impactoGlobal",
            er."impactoPersonas",
            er."impactoLegal",
            er."impactoAmbiental",
            er."impactoProcesos",
            er."impactoReputacion",
            er."impactoEconomico",
            er."nivelRiesgo"
        FROM "Riesgo" r
        LEFT JOIN "EvaluacionRiesgo" er ON r.id = er."riesgoId"
        WHERE er.id IS NOT NULL  -- Solo riesgos con evaluación
        ORDER BY r.id
    LOOP
        total_riesgos := total_riesgos + 1;
        
        -- Calcular calificación global impacto desde campos individuales
        calificacion_global_impacto := ROUND(
            (COALESCE(riesgo_record."impactoPersonas", 1) * 0.10) +      -- Personas: 10%
            (COALESCE(riesgo_record."impactoLegal", 1) * 0.22) +         -- Legal: 22%
            (COALESCE(riesgo_record."impactoAmbiental", 1) * 0.10) +    -- Ambiental: 10%
            (COALESCE(riesgo_record."impactoProcesos", 1) * 0.14) +     -- Procesos: 14%
            (COALESCE(riesgo_record."impactoReputacion", 1) * 0.22) +   -- Reputación: 22%
            (COALESCE(riesgo_record."impactoEconomico", 1) * 0.22)      -- Económico: 22%
        );
        
        -- Calcular máximo de todas las causas
        SELECT 
            COALESCE(MAX(
                CASE 
                    WHEN cr.frecuencia::text ~ '^[0-9]+$' THEN
                        -- Frecuencia es un ID numérico
                        CASE 
                            WHEN fc.peso IS NOT NULL THEN
                                -- Aplicar excepción 2x2 = 3.99
                                CASE 
                                    WHEN fc.peso = 2 AND calificacion_global_impacto = 2 THEN 3.99
                                    ELSE calificacion_global_impacto * fc.peso
                                END
                            ELSE
                                CASE 
                                    WHEN cr.frecuencia::integer = 2 AND calificacion_global_impacto = 2 THEN 3.99
                                    ELSE calificacion_global_impacto * cr.frecuencia::integer
                                END
                        END
                    ELSE
                        -- Frecuencia es un label, buscar en catálogo
                        CASE 
                            WHEN fc.peso IS NOT NULL THEN
                                CASE 
                                    WHEN fc.peso = 2 AND calificacion_global_impacto = 2 THEN 3.99
                                    ELSE calificacion_global_impacto * fc.peso
                                END
                            ELSE
                                CASE 
                                    WHEN (SELECT peso FROM "FrecuenciaCatalog" WHERE label = cr.frecuencia LIMIT 1) = 2 AND calificacion_global_impacto = 2 THEN 3.99
                                    ELSE calificacion_global_impacto * COALESCE((SELECT peso FROM "FrecuenciaCatalog" WHERE label = cr.frecuencia LIMIT 1), 3)
                                END
                        END
                END
            ), 0)
        INTO max_calificacion_inherente
        FROM "CausaRiesgo" cr
        LEFT JOIN "FrecuenciaCatalog" fc ON (
            (cr.frecuencia::text ~ '^[0-9]+$' AND fc.id::text = cr.frecuencia::text) OR
            (fc.label = cr.frecuencia)
        )
        WHERE cr."riesgoId" = riesgo_record.riesgo_id;
        
        -- Si no hay causas, establecer a 0
        IF max_calificacion_inherente IS NULL OR max_calificacion_inherente = 0 THEN
            riesgos_sin_causas := riesgos_sin_causas + 1;
            -- Actualizar a 0 si no hay causas
            UPDATE "EvaluacionRiesgo"
            SET 
                "riesgoInherente" = 0,
                "nivelRiesgo" = 'Sin Calificar',
                probabilidad = 1,
                "impactoGlobal" = 1
            WHERE "riesgoId" = riesgo_record.riesgo_id;
            RAISE NOTICE 'Riesgo % (%) - Sin causas, establecido a 0', 
                riesgo_record.riesgo_id, riesgo_record."numeroIdentificacion";
            CONTINUE;
        END IF;
        
        riesgo_inherente_actual := riesgo_record."riesgoInherente";
        
        -- Convertir riesgoInherente a probabilidad e impacto (mismo algoritmo que backend/frontend)
        mejor_prob := 1;
        mejor_imp := 1;
        encontrado_exacto := FALSE;
        
        -- Primero buscar combinaciones balanceadas (prob == imp)
        FOR prob IN REVERSE 5..1 LOOP
            mejor_imp := prob;
            valor_calculado := CASE WHEN prob = 2 AND mejor_imp = 2 THEN 3.99 ELSE prob * mejor_imp END;
            IF ABS(valor_calculado - max_calificacion_inherente) < 0.01 THEN
                mejor_prob := prob;
                encontrado_exacto := TRUE;
                EXIT;
            END IF;
        END LOOP;
        
        -- Si no encontramos balanceada, buscar cualquier coincidencia exacta
        IF NOT encontrado_exacto THEN
            FOR imp IN REVERSE 5..1 LOOP
                FOR prob IN 1..5 LOOP
                    valor_calculado := CASE WHEN prob = 2 AND imp = 2 THEN 3.99 ELSE prob * imp END;
                    IF ABS(valor_calculado - max_calificacion_inherente) < 0.01 THEN
                        mejor_prob := prob;
                        mejor_imp := imp;
                        encontrado_exacto := TRUE;
                        EXIT;
                    END IF;
                END LOOP;
                IF encontrado_exacto THEN EXIT; END IF;
            END LOOP;
        END IF;
        
        -- Si no hay coincidencia exacta, buscar el más cercano >=
        IF NOT encontrado_exacto THEN
            menor_diferencia := INFINITY;
            FOR prob IN 1..5 LOOP
                FOR imp IN 1..5 LOOP
                    valor_calculado := CASE WHEN prob = 2 AND imp = 2 THEN 3.99 ELSE prob * imp END;
                    IF valor_calculado >= max_calificacion_inherente THEN
                        IF (valor_calculado - max_calificacion_inherente) < menor_diferencia THEN
                            menor_diferencia := valor_calculado - max_calificacion_inherente;
                            mejor_prob := prob;
                            mejor_imp := imp;
                        END IF;
                    END IF;
                END LOOP;
            END LOOP;
            
            -- Si aún no hay valor >=, usar el más cercano
            IF menor_diferencia = INFINITY THEN
                menor_diferencia := INFINITY;
                FOR prob IN 1..5 LOOP
                    FOR imp IN 1..5 LOOP
                        valor_calculado := CASE WHEN prob = 2 AND imp = 2 THEN 3.99 ELSE prob * imp END;
                        IF ABS(max_calificacion_inherente - valor_calculado) < menor_diferencia THEN
                            menor_diferencia := ABS(max_calificacion_inherente - valor_calculado);
                            mejor_prob := prob;
                            mejor_imp := imp;
                        END IF;
                    END LOOP;
                END LOOP;
            END IF;
        END IF;
        
        -- Determinar nivel de riesgo (simplificado - usar rangos estándar)
        DECLARE
            nivel_riesgo TEXT;
        BEGIN
            IF max_calificacion_inherente >= 15 AND max_calificacion_inherente <= 25 THEN
                nivel_riesgo := 'Crítico';
            ELSIF max_calificacion_inherente >= 10 AND max_calificacion_inherente <= 14 THEN
                nivel_riesgo := 'Alto';
            ELSIF max_calificacion_inherente >= 4 AND max_calificacion_inherente <= 9 THEN
                nivel_riesgo := 'Medio';
            ELSIF max_calificacion_inherente >= 1 AND max_calificacion_inherente <= 3 OR max_calificacion_inherente = 3.99 THEN
                nivel_riesgo := 'Bajo';
            ELSE
                nivel_riesgo := 'Sin Calificar';
            END IF;
            
            -- Actualizar evaluación
            UPDATE "EvaluacionRiesgo"
            SET 
                "riesgoInherente" = ROUND(max_calificacion_inherente),
                "nivelRiesgo" = nivel_riesgo,
                probabilidad = mejor_prob,
                "impactoGlobal" = mejor_imp
            WHERE "riesgoId" = riesgo_record.riesgo_id;
            
            -- Verificar si hubo cambios
            IF ABS(riesgo_inherente_actual - max_calificacion_inherente) > 0.01 OR
               riesgo_record.probabilidad != mejor_prob OR
               riesgo_record."impactoGlobal" != mejor_imp THEN
                riesgos_corregidos := riesgos_corregidos + 1;
                RAISE NOTICE '✅ Riesgo % (%) - CORREGIDO:', 
                    riesgo_record.riesgo_id, riesgo_record."numeroIdentificacion";
                IF ABS(riesgo_inherente_actual - max_calificacion_inherente) > 0.01 THEN
                    RAISE NOTICE '   riesgoInherente: %.2f -> %.2f', 
                        riesgo_inherente_actual, max_calificacion_inherente;
                END IF;
                IF riesgo_record.probabilidad != mejor_prob OR riesgo_record."impactoGlobal" != mejor_imp THEN
                    RAISE NOTICE '   Prob/Imp: %/% -> %/% (verificación: %×%=%)', 
                        riesgo_record.probabilidad, riesgo_record."impactoGlobal",
                        mejor_prob, mejor_imp,
                        mejor_prob, mejor_imp,
                        CASE WHEN mejor_prob = 2 AND mejor_imp = 2 THEN 3.99 ELSE mejor_prob * mejor_imp END;
                END IF;
            END IF;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN DE CORRECCIÓN:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total de riesgos procesados: %', total_riesgos;
    RAISE NOTICE 'Riesgos sin causas: %', riesgos_sin_causas;
    RAISE NOTICE 'Riesgos corregidos: %', riesgos_corregidos;
    RAISE NOTICE 'Riesgos que ya estaban correctos: %', total_riesgos - riesgos_corregidos - riesgos_sin_causas;
    RAISE NOTICE '';
    
    IF riesgos_corregidos > 0 THEN
        RAISE NOTICE '✅ CORRECCIÓN COMPLETADA';
    ELSE
        RAISE NOTICE 'ℹ️ No se encontraron riesgos que necesitaran corrección';
    END IF;
END $$;

