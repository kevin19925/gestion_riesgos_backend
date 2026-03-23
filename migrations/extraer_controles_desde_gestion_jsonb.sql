-- =====================================================
-- EXTRAER CONTROLES DESDE BACKUP PRE-MIGRACIÓN
-- =====================================================
-- Este script debe ejecutarse en la base de datos: temp_backup_pre_migracion
-- 
-- IMPORTANTE: 
-- 1. Conectarse a la base de datos temp_backup_pre_migracion en pgAdmin
-- 2. Ejecutar cada paso por separado
-- 3. Revisar los resultados antes de continuar
-- =====================================================

-- PASO 1: Verificar que estamos en la base correcta y ver estructura
SELECT 
    current_database() as base_datos_actual,
    COUNT(*) as total_causas
FROM "CausaRiesgo";

-- PASO 2: Ver columnas disponibles en CausaRiesgo
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;

-- PASO 3: Ver ejemplos de registros con todos los campos
SELECT 
    id,
    "riesgoId",
    descripcion,
    "fuenteCausa",
    frecuencia
FROM "CausaRiesgo"
LIMIT 5;

-- PASO 4: Si existe la columna 'gestion', ver su contenido
-- (Ejecutar solo si el PASO 2 muestra que existe la columna 'gestion')
SELECT 
    id,
    "riesgoId",
    jsonb_pretty(gestion) as gestion_formateado
FROM "CausaRiesgo"
WHERE gestion IS NOT NULL
LIMIT 3;

-- PASO 5: Si existe 'tipoGestion', contar por tipo
-- (Ejecutar solo si el PASO 2 muestra que existe la columna 'tipoGestion')
SELECT 
    "tipoGestion",
    COUNT(*) as cantidad
FROM "CausaRiesgo"
GROUP BY "tipoGestion";

-- PASO 6: Ver estructura completa de una causa con gestion
-- (Ejecutar solo si existe la columna 'gestion')
SELECT 
    id,
    "riesgoId",
    descripcion,
    "tipoGestion",
    gestion
FROM "CausaRiesgo"
WHERE gestion IS NOT NULL
LIMIT 1;
