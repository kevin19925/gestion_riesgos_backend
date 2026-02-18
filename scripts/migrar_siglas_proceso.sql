-- Script para generar siglas desde el nombre del proceso
-- Este script es seguro y NO elimina datos existentes
-- FORZARÁ la regeneración de todas las siglas desde el nombre del proceso

-- PASO 1: Agregar la columna 'sigla' a la tabla 'Proceso' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Proceso' 
        AND column_name = 'sigla'
    ) THEN
        ALTER TABLE "Proceso" ADD COLUMN "sigla" TEXT;
        RAISE NOTICE 'Columna sigla agregada a la tabla Proceso';
    ELSE
        RAISE NOTICE 'La columna sigla ya existe en la tabla Proceso';
    END IF;
END $$;

-- PASO 2: Generar siglas desde el nombre del proceso (FORZAR regeneración de todas)
DO $$
DECLARE
    proceso_record RECORD;
    sigla_generada TEXT;
    palabras TEXT[];
    palabra TEXT;
    sigla_temp TEXT;
    palabras_ignorar TEXT[] := ARRAY['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'a', 'al', 'en', 'por', 'para', 'con', 'sin'];
BEGIN
    -- Iterar sobre todos los procesos
    FOR proceso_record IN SELECT id, nombre FROM "Proceso" LOOP
        sigla_generada := NULL;
        sigla_temp := '';
        
        -- Generar sigla desde el nombre del proceso
        -- Ejemplo: "Gestión de Talento Humano" -> "GTH"
        -- Ejemplo: "Planificación Financiera" -> "PF"
        -- Ejemplo: "Direccionamiento Estratégico" -> "DE"
        -- Tomar la primera letra de cada palabra, ignorando palabras comunes
        
        -- Dividir el nombre en palabras
        palabras := string_to_array(LOWER(TRIM(proceso_record.nombre)), ' ');
        
        -- Iterar sobre cada palabra
        FOREACH palabra IN ARRAY palabras LOOP
            -- Remover caracteres especiales y espacios
            palabra := REGEXP_REPLACE(palabra, '[^a-záéíóúñ]', '', 'g');
            
            -- Si la palabra no está en la lista de ignorar y tiene al menos 1 carácter
            IF palabra != '' AND NOT (palabra = ANY(palabras_ignorar)) THEN
                -- Agregar la primera letra en mayúscula
                sigla_temp := sigla_temp || UPPER(SUBSTRING(palabra, 1, 1));
            END IF;
        END LOOP;
        
        -- Limitar a 4 caracteres máximo
        IF LENGTH(sigla_temp) > 4 THEN
            sigla_temp := SUBSTRING(sigla_temp, 1, 4);
        END IF;
        
        -- Si la sigla generada es válida (al menos 2 caracteres), usarla
        IF sigla_temp IS NOT NULL AND LENGTH(sigla_temp) >= 2 THEN
            sigla_generada := sigla_temp;
        END IF;
        
        -- Actualizar el proceso con la sigla generada (SIEMPRE, incluso si ya tenía una)
        IF sigla_generada IS NOT NULL THEN
            UPDATE "Proceso" 
            SET "sigla" = sigla_generada
            WHERE id = proceso_record.id;
            
            RAISE NOTICE 'Proceso ID % (%), sigla asignada: %', proceso_record.id, proceso_record.nombre, sigla_generada;
        ELSE
            -- Si no se pudo determinar la sigla, dejar NULL para que el usuario la complete manualmente
            RAISE NOTICE 'Proceso ID % (%), no se pudo determinar sigla automáticamente. Debe completarse manualmente.', proceso_record.id, proceso_record.nombre;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migración de siglas completada.';
END $$;

-- Verificación: Mostrar procesos con sus siglas asignadas
SELECT 
    id,
    nombre,
    sigla,
    (SELECT COUNT(*) FROM "Riesgo" WHERE "procesoId" = p.id) as total_riesgos
FROM "Proceso" p
ORDER BY id;
