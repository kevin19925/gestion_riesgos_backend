-- Script para actualizar numeroIdentificacion de riesgos existentes
-- Usa la nueva sigla del proceso para regenerar los IDs de los riesgos
-- Este script es seguro y NO elimina datos existentes

DO $$
DECLARE
    riesgo_record RECORD;
    proceso_sigla TEXT;
    numero_riesgo TEXT;
    nuevo_numero_identificacion TEXT;
BEGIN
    -- Iterar sobre todos los riesgos
    FOR riesgo_record IN 
        SELECT 
            r.id,
            r."procesoId",
            r.numero,
            r."numeroIdentificacion",
            p.sigla,
            p.nombre as proceso_nombre
        FROM "Riesgo" r
        INNER JOIN "Proceso" p ON r."procesoId" = p.id
        WHERE p.sigla IS NOT NULL AND p.sigla != ''
    LOOP
        -- Obtener la sigla del proceso
        proceso_sigla := riesgo_record.sigla;
        
        -- Obtener el número del riesgo (usar el campo 'numero' o extraer del numeroIdentificacion actual)
        IF riesgo_record.numero IS NOT NULL AND riesgo_record.numero > 0 THEN
            numero_riesgo := riesgo_record.numero::TEXT;
        ELSE
            -- Intentar extraer el número del numeroIdentificacion actual (ej: "1DAF" -> "1")
            numero_riesgo := REGEXP_REPLACE(riesgo_record."numeroIdentificacion", '[^0-9].*$', '');
            IF numero_riesgo = '' OR numero_riesgo IS NULL THEN
                -- Si no se puede extraer, usar el ID del riesgo como número
                numero_riesgo := riesgo_record.id::TEXT;
            END IF;
        END IF;
        
        -- Generar el nuevo numeroIdentificacion: número + sigla del proceso
        nuevo_numero_identificacion := numero_riesgo || proceso_sigla;
        
        -- Actualizar el riesgo con el nuevo numeroIdentificacion
        UPDATE "Riesgo"
        SET "numeroIdentificacion" = nuevo_numero_identificacion
        WHERE id = riesgo_record.id;
        
        RAISE NOTICE 'Riesgo ID %: % -> % (Proceso: %, Sigla: %)', 
            riesgo_record.id, 
            riesgo_record."numeroIdentificacion", 
            nuevo_numero_identificacion,
            riesgo_record.proceso_nombre,
            proceso_sigla;
    END LOOP;
    
    RAISE NOTICE 'Actualización de numeroIdentificacion completada.';
END $$;

-- Verificación: Mostrar algunos riesgos con sus nuevos numeroIdentificacion
SELECT 
    r.id,
    r.numero,
    r."numeroIdentificacion",
    p.nombre as proceso_nombre,
    p.sigla as proceso_sigla
FROM "Riesgo" r
INNER JOIN "Proceso" p ON r."procesoId" = p.id
ORDER BY r."procesoId", r.numero
LIMIT 20;

