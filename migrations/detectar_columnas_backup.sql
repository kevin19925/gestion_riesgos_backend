-- =====================================================
-- DETECTAR COLUMNAS DISPONIBLES EN BACKUP
-- =====================================================
-- Ejecutar en: temp_backup_pre_migracion
-- =====================================================

-- PASO 1: Ver TODAS las columnas de CausaRiesgo
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;

-- PASO 2: Contar total de columnas
SELECT 
    COUNT(*) as total_columnas
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo';

-- PASO 3: Ver un registro completo (todas las columnas)
-- Esto mostrará TODAS las columnas con sus valores
SELECT *
FROM "CausaRiesgo"
WHERE "tipoGestion" = 'CONTROL'
LIMIT 1;

-- PASO 4: Buscar columnas que contengan 'control' en el nombre
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
AND column_name ILIKE '%control%'
ORDER BY column_name;

-- PASO 5: Buscar columnas que contengan 'descripcion' en el nombre
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
AND column_name ILIKE '%descripcion%'
ORDER BY column_name;

-- PASO 6: Listar columnas relacionadas con evaluación
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
AND (
    column_name ILIKE '%evaluacion%'
    OR column_name ILIKE '%puntaje%'
    OR column_name ILIKE '%mitigacion%'
    OR column_name ILIKE '%aplicabilidad%'
    OR column_name ILIKE '%cobertura%'
    OR column_name ILIKE '%naturaleza%'
    OR column_name ILIKE '%segregacion%'
)
ORDER BY column_name;
