-- ============================================
-- SCRIPT COMPLETO PARA ARREGLAR CALIFICACIONES Y MAPA
-- Ejecutar en pgAdmin conectado a riesgos_db_cv8c
-- ============================================

-- ============================================
-- PASO 1: Agregar columnas faltantes
-- ============================================

-- TABLA: Riesgo
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Riesgo' AND column_name = 'zona') THEN
        ALTER TABLE "Riesgo" ADD COLUMN "zona" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Riesgo' AND column_name = 'numeroIdentificacion') THEN
        ALTER TABLE "Riesgo" ADD COLUMN "numeroIdentificacion" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Riesgo' AND column_name = 'tipologiaNivelI') THEN
        ALTER TABLE "Riesgo" ADD COLUMN "tipologiaNivelI" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Riesgo' AND column_name = 'tipologiaNivelII') THEN
        ALTER TABLE "Riesgo" ADD COLUMN "tipologiaNivelII" TEXT;
    END IF;
END $$;

-- TABLA: CausaRiesgo - Cambiar frecuencia a TEXT
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CausaRiesgo' AND column_name = 'frecuencia' AND data_type = 'integer') THEN
        ALTER TABLE "CausaRiesgo" ALTER COLUMN "frecuencia" TYPE TEXT USING frecuencia::TEXT;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CausaRiesgo' AND column_name = 'frecuencia') THEN
        ALTER TABLE "CausaRiesgo" ADD COLUMN "frecuencia" TEXT;
    END IF;
END $$;

-- TABLA: EvaluacionRiesgo - Agregar columnas SGSI y riesgoInherente
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EvaluacionRiesgo' AND column_name = 'riesgoInherente') THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "riesgoInherente" INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EvaluacionRiesgo' AND column_name = 'confidencialidadSGSI') THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "confidencialidadSGSI" INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EvaluacionRiesgo' AND column_name = 'disponibilidadSGSI') THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "disponibilidadSGSI" INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'EvaluacionRiesgo' AND column_name = 'integridadSGSI') THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "integridadSGSI" INTEGER;
    END IF;
END $$;

-- ============================================
-- PASO 2: Función para calcular calificación inherente por causa
-- ============================================

CREATE OR REPLACE FUNCTION calcular_calificacion_inherente_causa(
    impacto_global INTEGER,
    frecuencia_val TEXT
) RETURNS NUMERIC AS $$
DECLARE
    frecuencia_num INTEGER;
    resultado NUMERIC;
BEGIN
    -- Convertir frecuencia de texto a número (1-5)
    -- Puede venir como número string ('1', '2', etc.) o como texto descriptivo
    frecuencia_num := CASE 
        WHEN frecuencia_val IS NULL THEN 3
        WHEN frecuencia_val = '1' OR frecuencia_val::TEXT LIKE '1%' OR LOWER(frecuencia_val) LIKE '%muy baja%' THEN 1
        WHEN frecuencia_val = '2' OR frecuencia_val::TEXT LIKE '2%' OR LOWER(frecuencia_val) LIKE '%baja%' THEN 2
        WHEN frecuencia_val = '3' OR frecuencia_val::TEXT LIKE '3%' OR LOWER(frecuencia_val) LIKE '%media%' THEN 3
        WHEN frecuencia_val = '4' OR frecuencia_val::TEXT LIKE '4%' OR LOWER(frecuencia_val) LIKE '%alta%' THEN 4
        WHEN frecuencia_val = '5' OR frecuencia_val::TEXT LIKE '5%' OR LOWER(frecuencia_val) LIKE '%muy alta%' THEN 5
        ELSE 
            CASE 
                WHEN frecuencia_val ~ '^[0-9]+$' THEN frecuencia_val::INTEGER
                ELSE 3
            END
    END;
    
    -- Caso especial: 2x2 = 3.99
    IF impacto_global = 2 AND frecuencia_num = 2 THEN
        RETURN 3.99;
    END IF;
    
    -- Calcular: impacto * frecuencia
    resultado := impacto_global * frecuencia_num;
    RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PASO 3: Calcular y actualizar calificación inherente global para TODOS los riesgos
-- ============================================

DO $$
DECLARE
    riesgo_record RECORD;
    causa_record RECORD;
    calificacion_maxima NUMERIC;
    calificacion_actual NUMERIC;
    impacto_global_riesgo INTEGER;
    probabilidad_calculada INTEGER;
    impacto_calculado INTEGER;
    nivel_riesgo TEXT;
    mejor_prob INTEGER;
    mejor_imp INTEGER;
    menor_diferencia NUMERIC;
    diferencia_actual NUMERIC;
    prob INTEGER;
    imp INTEGER;
    valor_celda NUMERIC;
    encontrado_exacto BOOLEAN;
BEGIN
    -- Recorrer todos los riesgos que tienen evaluación
    FOR riesgo_record IN 
        SELECT r.id, r."procesoId", e.id as evaluacion_id, e."impactoGlobal", e."probabilidad"
        FROM "Riesgo" r
        INNER JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
    LOOP
        calificacion_maxima := 0;
        impacto_global_riesgo := COALESCE(riesgo_record."impactoGlobal", 1);
        
        -- Recorrer todas las causas del riesgo
        FOR causa_record IN
            SELECT c.id, c."descripcion", c."frecuencia"
            FROM "CausaRiesgo" c
            WHERE c."riesgoId" = riesgo_record.id
        LOOP
            -- Calcular calificación inherente de esta causa
            -- Usar impactoGlobal del riesgo (las causas no tienen calificacionGlobalImpacto propia)
            -- Esto es consistente con el frontend que usa calificacionGlobalImpacto del riesgo si la causa no lo tiene
            calificacion_actual := calcular_calificacion_inherente_causa(
                impacto_global_riesgo,
                COALESCE(causa_record."frecuencia"::TEXT, '3')
            );
            
            -- Actualizar el máximo
            IF calificacion_actual > calificacion_maxima THEN
                calificacion_maxima := calificacion_actual;
            END IF;
        END LOOP;
        
        -- Si no hay causas, usar probabilidad * impactoGlobal como fallback
        IF calificacion_maxima = 0 THEN
            calificacion_maxima := riesgo_record."probabilidad" * impacto_global_riesgo;
        END IF;
        
        -- Determinar nivel de riesgo
        nivel_riesgo := CASE
            WHEN calificacion_maxima >= 15 AND calificacion_maxima <= 25 THEN 'Crítico'
            WHEN calificacion_maxima >= 10 AND calificacion_maxima <= 14 THEN 'Alto'
            WHEN calificacion_maxima >= 4 AND calificacion_maxima <= 9 THEN 'Medio'
            WHEN calificacion_maxima >= 1 AND calificacion_maxima <= 3 THEN 'Bajo'
            ELSE 'Sin Calificar'
        END;
        
        -- Calcular probabilidad e impacto para el mapa (buscar mejor combinación)
        -- Primero buscar coincidencia exacta, luego el más cercano >=
        mejor_prob := 1;
        mejor_imp := 1;
        encontrado_exacto := FALSE;
        
        -- Primero buscar coincidencia exacta
        FOR prob IN 1..5 LOOP
            FOR imp IN 1..5 LOOP
                -- Caso especial 2x2 = 3.99
                IF prob = 2 AND imp = 2 THEN
                    valor_celda := 3.99;
                ELSE
                    valor_celda := prob * imp;
                END IF;
                
                IF ABS(valor_celda - calificacion_maxima) < 0.01 THEN
                    mejor_prob := prob;
                    mejor_imp := imp;
                    encontrado_exacto := TRUE;
                    EXIT;
                END IF;
            END LOOP;
            IF encontrado_exacto THEN
                EXIT;
            END IF;
        END LOOP;
        
        -- Si no hay coincidencia exacta, buscar el más cercano >= calificacion_maxima
        IF NOT encontrado_exacto THEN
            menor_diferencia := 999999;
            FOR prob IN 1..5 LOOP
                FOR imp IN 1..5 LOOP
                    -- Caso especial 2x2 = 3.99
                    IF prob = 2 AND imp = 2 THEN
                        valor_celda := 3.99;
                    ELSE
                        valor_celda := prob * imp;
                    END IF;
                    
                    -- Priorizar valores que sean >= calificacion_maxima (no menores)
                    IF valor_celda >= calificacion_maxima THEN
                        diferencia_actual := valor_celda - calificacion_maxima;
                        IF diferencia_actual < menor_diferencia THEN
                            menor_diferencia := diferencia_actual;
                            mejor_prob := prob;
                            mejor_imp := imp;
                        END IF;
                    END IF;
                END LOOP;
            END LOOP;
            
            -- Si aún no hay valor >=, usar el más cercano (menor)
            IF menor_diferencia = 999999 THEN
                menor_diferencia := 999999;
                FOR prob IN 1..5 LOOP
                    FOR imp IN 1..5 LOOP
                        -- Caso especial 2x2 = 3.99
                        IF prob = 2 AND imp = 2 THEN
                            valor_celda := 3.99;
                        ELSE
                            valor_celda := prob * imp;
                        END IF;
                        
                        diferencia_actual := ABS(calificacion_maxima - valor_celda);
                        IF diferencia_actual < menor_diferencia THEN
                            menor_diferencia := diferencia_actual;
                            mejor_prob := prob;
                            mejor_imp := imp;
                        END IF;
                    END LOOP;
                END LOOP;
            END IF;
        END IF;
        
        -- Actualizar la evaluación con los valores calculados
        UPDATE "EvaluacionRiesgo"
        SET 
            "riesgoInherente" = ROUND(calificacion_maxima),
            "nivelRiesgo" = nivel_riesgo,
            "probabilidad" = mejor_prob,
            "impactoGlobal" = mejor_imp
        WHERE id = riesgo_record.evaluacion_id;
        
        RAISE NOTICE 'Riesgo %: Calificación=%, Nivel=%, Prob=%, Imp=%', 
            riesgo_record.id, calificacion_maxima, nivel_riesgo, mejor_prob, mejor_imp;
    END LOOP;
    
    RAISE NOTICE '✅ Calificaciones inherentes globales actualizadas para todos los riesgos';
END $$;

-- ============================================
-- PASO 4: Verificar resultados
-- ============================================

SELECT 
    r.id as riesgo_id,
    r."numero" as numero_riesgo,
    r."descripcion",
    e."riesgoInherente" as calificacion_inherente_global,
    e."nivelRiesgo",
    e."probabilidad",
    e."impactoGlobal",
    (SELECT COUNT(*) FROM "CausaRiesgo" WHERE "riesgoId" = r.id) as total_causas
FROM "Riesgo" r
INNER JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
ORDER BY e."riesgoInherente" DESC, r.id
LIMIT 20;

-- ============================================
-- PASO 5: Verificar columnas agregadas
-- ============================================

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('Riesgo', 'CausaRiesgo', 'EvaluacionRiesgo')
AND column_name IN (
    'zona', 'numeroIdentificacion', 'tipologiaNivelI', 'tipologiaNivelII',
    'frecuencia',
    'riesgoInherente', 'confidencialidadSGSI', 'disponibilidadSGSI', 'integridadSGSI'
)
ORDER BY table_name, column_name;

