-- ============================================================================
-- VERIFICACIÓN PRE-MIGRACIÓN
-- ============================================================================
-- Ejecutar este script ANTES de la migración para verificar el estado actual
-- ============================================================================

-- 1. Ver estructura de la tabla
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ProcesoResponsable'
ORDER BY ordinal_position;

-- 2. Ver constraints actuales
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'ProcesoResponsable'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

-- 3. Estadísticas de datos actuales
SELECT 
    'Total de registros' as descripcion,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"

UNION ALL

SELECT 
    'Registros con modo "ambos"' as descripcion,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
WHERE modo = 'ambos'

UNION ALL

SELECT 
    'Registros con modo NULL' as descripcion,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
WHERE modo IS NULL

UNION ALL

SELECT 
    'Registros con modo "director"' as descripcion,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
WHERE modo = 'director'

UNION ALL

SELECT 
    'Registros con modo "proceso"' as descripcion,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
WHERE modo = 'proceso';

-- 4. Ver algunos registros de ejemplo
SELECT 
    id,
    "procesoId",
    "usuarioId",
    modo,
    "createdAt"
FROM "ProcesoResponsable"
ORDER BY id
LIMIT 10;

-- 5. Verificar si hay duplicados potenciales
SELECT 
    "procesoId",
    "usuarioId",
    COUNT(*) as cantidad,
    string_agg(COALESCE(modo, 'NULL'), ', ') as modos
FROM "ProcesoResponsable"
GROUP BY "procesoId", "usuarioId"
HAVING COUNT(*) > 1;

-- ============================================================================
-- INTERPRETACIÓN DE RESULTADOS:
-- ============================================================================
-- - Si hay registros con modo "ambos" o NULL, serán duplicados en la migración
-- - Si ya hay duplicados (procesoId + usuarioId repetidos), la migración
--   puede fallar. En ese caso, hay que limpiar manualmente primero.
-- ============================================================================
