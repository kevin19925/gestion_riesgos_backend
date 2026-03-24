-- =====================================================
-- VERIFICACIÓN: Tablas de Reuniones
-- =====================================================

-- 1. Verificar que las tablas existen
SELECT 
    tablename, 
    schemaname 
FROM pg_tables 
WHERE tablename IN ('AsistentesProceso', 'ReunionProceso', 'AsistenciaReunion')
ORDER BY tablename;

-- 2. Verificar estructura de AsistentesProceso
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'AsistentesProceso'
ORDER BY ordinal_position;

-- 3. Verificar estructura de ReunionProceso
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ReunionProceso'
ORDER BY ordinal_position;

-- 4. Verificar estructura de AsistenciaReunion
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'AsistenciaReunion'
ORDER BY ordinal_position;

-- 5. Verificar constraints (foreign keys, unique, etc.)
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid::regclass::text IN ('AsistentesProceso', 'ReunionProceso', 'AsistenciaReunion')
ORDER BY table_name, constraint_name;

-- 6. Contar registros en cada tabla
SELECT 'AsistentesProceso' as tabla, COUNT(*) as registros FROM "AsistentesProceso"
UNION ALL
SELECT 'ReunionProceso' as tabla, COUNT(*) as registros FROM "ReunionProceso"
UNION ALL
SELECT 'AsistenciaReunion' as tabla, COUNT(*) as registros FROM "AsistenciaReunion";
