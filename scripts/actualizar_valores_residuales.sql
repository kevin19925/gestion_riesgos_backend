-- ============================================
-- SCRIPT: Actualizar Valores Residuales desde Causas con Controles
-- Este script calcula y actualiza los valores residuales en EvaluacionRiesgo
-- basándose en las causas con controles de cada riesgo
-- ============================================

DO $$
DECLARE
    riesgo_record RECORD;
    causa_record RECORD;
    calificacion_maxima_residual NUMERIC;
    mejor_prob_res INTEGER;
    mejor_imp_res INTEGER;
    menor_diferencia_res NUMERIC;
    diferencia_actual_res NUMERIC;
    prob_res INTEGER;
    imp_res INTEGER;
    valor_celda_res NUMERIC;
    nivel_riesgo_residual TEXT;
    tiene_controles BOOLEAN;
BEGIN
    RAISE NOTICE '[INICIO] Iniciando actualizacion de valores residuales...';
    
    FOR riesgo_record IN 
        SELECT r.id, r."procesoId", e.id as evaluacion_id, e."riesgoInherente", e."probabilidad", e."impactoGlobal"
        FROM "Riesgo" r
        INNER JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
    LOOP
        tiene_controles := false;
        calificacion_maxima_residual := 0;
        
        -- Buscar causas con controles para este riesgo
        FOR causa_record IN
            SELECT c.id, c."descripcion", c."frecuencia", c."tipoGestion", c."gestion"
            FROM "CausaRiesgo" c
            WHERE c."riesgoId" = riesgo_record.id
              AND (c."tipoGestion" = 'CONTROL' OR c."tipoGestion" = 'control')
        LOOP
            tiene_controles := true;
            
            -- Obtener calificación residual de la causa desde el JSON gestion o calcular
            DECLARE
                calificacion_causa NUMERIC;
                gestion_json JSONB;
                freq_res NUMERIC;
                imp_res NUMERIC;
                freq_inh NUMERIC;
                imp_inh NUMERIC;
            BEGIN
                -- Intentar leer desde el JSON gestion
                gestion_json := causa_record."gestion"::JSONB;
                
                -- Priorizar calificacionResidual del JSON, luego calcular desde frecuenciaResidual e impactoResidual
                IF gestion_json IS NOT NULL THEN
                    -- Intentar leer calificacionResidual del JSON
                    IF (gestion_json->>'calificacionResidual') IS NOT NULL THEN
                        calificacion_causa := (gestion_json->>'calificacionResidual')::NUMERIC;
                    ELSIF (gestion_json->>'riesgoResidual') IS NOT NULL THEN
                        calificacion_causa := (gestion_json->>'riesgoResidual')::NUMERIC;
                    ELSIF (gestion_json->>'frecuenciaResidual') IS NOT NULL AND (gestion_json->>'impactoResidual') IS NOT NULL THEN
                        -- Calcular desde frecuenciaResidual e impactoResidual del JSON
                        freq_res := (gestion_json->>'frecuenciaResidual')::NUMERIC;
                        imp_res := (gestion_json->>'impactoResidual')::NUMERIC;
                        IF freq_res = 2 AND imp_res = 2 THEN
                            calificacion_causa := 3.99;
                        ELSE
                            calificacion_causa := freq_res * imp_res;
                        END IF;
                    ELSE
                        -- Fallback: calcular desde valores inherentes
                        freq_inh := CASE 
                            WHEN causa_record."frecuencia"::TEXT = '1' THEN 1
                            WHEN causa_record."frecuencia"::TEXT = '2' THEN 2
                            WHEN causa_record."frecuencia"::TEXT = '3' THEN 3
                            WHEN causa_record."frecuencia"::TEXT = '4' THEN 4
                            WHEN causa_record."frecuencia"::TEXT = '5' THEN 5
                            ELSE COALESCE((causa_record."frecuencia"::TEXT)::INTEGER, 3)
                        END;
                        imp_inh := COALESCE(riesgo_record."impactoGlobal", 1);
                        
                        IF freq_inh = 2 AND imp_inh = 2 THEN
                            calificacion_causa := 3.99;
                        ELSE
                            calificacion_causa := freq_inh * imp_inh;
                        END IF;
                    END IF;
                ELSE
                    -- Si no hay JSON, calcular desde valores inherentes
                    freq_inh := CASE 
                        WHEN causa_record."frecuencia"::TEXT = '1' THEN 1
                        WHEN causa_record."frecuencia"::TEXT = '2' THEN 2
                        WHEN causa_record."frecuencia"::TEXT = '3' THEN 3
                        WHEN causa_record."frecuencia"::TEXT = '4' THEN 4
                        WHEN causa_record."frecuencia"::TEXT = '5' THEN 5
                        ELSE COALESCE((causa_record."frecuencia"::TEXT)::INTEGER, 3)
                    END;
                    imp_inh := COALESCE(riesgo_record."impactoGlobal", 1);
                    
                    IF freq_inh = 2 AND imp_inh = 2 THEN
                        calificacion_causa := 3.99;
                    ELSE
                        calificacion_causa := freq_inh * imp_inh;
                    END IF;
                END IF;
                
                IF calificacion_causa > calificacion_maxima_residual THEN
                    calificacion_maxima_residual := calificacion_causa;
                END IF;
            END;
        END LOOP;
        
        -- Si no hay controles, usar valores inherentes
        IF NOT tiene_controles THEN
            calificacion_maxima_residual := COALESCE(riesgo_record."riesgoInherente",
                                                    riesgo_record."probabilidad" * riesgo_record."impactoGlobal",
                                                    0);
        END IF;
        
        -- Si hay calificación residual, calcular probabilidad e impacto residuales
        IF calificacion_maxima_residual > 0 THEN
            -- Calcular nivel de riesgo residual
            nivel_riesgo_residual := CASE
                WHEN calificacion_maxima_residual >= 15 AND calificacion_maxima_residual <= 25 THEN 'Critico'
                WHEN calificacion_maxima_residual >= 10 AND calificacion_maxima_residual <= 14 THEN 'Alto'
                WHEN calificacion_maxima_residual >= 4 AND calificacion_maxima_residual <= 9 THEN 'Medio'
                WHEN calificacion_maxima_residual >= 1 AND calificacion_maxima_residual <= 3 THEN 'Bajo'
                ELSE 'Sin Calificar'
            END;
            
            -- Convertir calificación residual a probabilidad e impacto para el mapa
            mejor_prob_res := 1;
            mejor_imp_res := 1;
            menor_diferencia_res := ABS(calificacion_maxima_residual - (mejor_prob_res * mejor_imp_res));
            
            FOR prob_res IN 1..5 LOOP
                FOR imp_res IN 1..5 LOOP
                    valor_celda_res := prob_res * imp_res;
                    IF prob_res = 2 AND imp_res = 2 THEN
                        valor_celda_res := 3.99;
                    END IF;
                    
                    -- Priorizar valores que sean >= calificacion_maxima_residual
                    IF valor_celda_res >= calificacion_maxima_residual THEN
                        diferencia_actual_res := valor_celda_res - calificacion_maxima_residual;
                        IF diferencia_actual_res < menor_diferencia_res OR 
                           (menor_diferencia_res > 0 AND valor_celda_res < (mejor_prob_res * mejor_imp_res)) THEN
                            menor_diferencia_res := diferencia_actual_res;
                            mejor_prob_res := prob_res;
                            mejor_imp_res := imp_res;
                        END IF;
                    ELSE
                        diferencia_actual_res := ABS(calificacion_maxima_residual - valor_celda_res);
                        IF diferencia_actual_res < menor_diferencia_res THEN
                            menor_diferencia_res := diferencia_actual_res;
                            mejor_prob_res := prob_res;
                            mejor_imp_res := imp_res;
                        END IF;
                    END IF;
                END LOOP;
            END LOOP;
            
            -- Actualizar evaluación con valores residuales
            UPDATE "EvaluacionRiesgo"
            SET 
                "riesgoResidual" = ROUND(calificacion_maxima_residual),
                "probabilidadResidual" = mejor_prob_res,
                "impactoResidual" = mejor_imp_res,
                "nivelRiesgoResidual" = nivel_riesgo_residual
            WHERE id = riesgo_record.evaluacion_id;
            
            RAISE NOTICE '[OK] Riesgo %: Residual=%, Nivel=%, ProbRes=%, ImpRes=%', 
                riesgo_record.id, 
                calificacion_maxima_residual, 
                nivel_riesgo_residual, 
                mejor_prob_res, 
                mejor_imp_res;
        ELSE
            RAISE NOTICE '[WARN] Riesgo %: Sin calificacion residual (sin controles o sin causas)', riesgo_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE '[FIN] Actualizacion de valores residuales completada';
END $$;

-- Verificar resultados
SELECT 
    r.id AS riesgo_id,
    r."numero" || COALESCE(r."siglaGerencia", '') AS codigo_riesgo,
    e."riesgoInherente" AS inherente,
    e."riesgoResidual" AS residual,
    e."probabilidad" AS prob_inh,
    e."impactoGlobal" AS imp_inh,
    e."probabilidadResidual" AS prob_res,
    e."impactoResidual" AS imp_res,
    e."nivelRiesgo" AS nivel_inh,
    e."nivelRiesgoResidual" AS nivel_res,
    (SELECT COUNT(*) FROM "CausaRiesgo" WHERE "riesgoId" = r.id AND "tipoGestion" = 'CONTROL') AS num_controles
FROM "Riesgo" r
INNER JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
ORDER BY r.id;

