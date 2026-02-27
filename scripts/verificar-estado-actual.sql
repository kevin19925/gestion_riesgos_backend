-- Script para verificar el estado actual de la tabla ProcesoResponsable
-- Ejecuta estos comandos uno por uno en tu cliente de base de datos

-- 1. Ver todas las tablas para confirmar el nombre exacto
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename ILIKE '%responsable%'
ORDER BY tablename;

-- 2. Ver la estructura de la tabla ProcesoResponsable
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ProcesoResponsable'
ORDER BY ordinal_position;

-- 3. Ver los constraints únicos actuales
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'ProcesoResponsable'
AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_name;

-- 4. Ver índices existentes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'ProcesoResponsable'
ORDER BY indexname;

-- 5. Ver datos de ejemplo (primeros 5 registros)
SELECT 
    id,
    "procesoId",
    "usuarioId",
    modo,
    "createdAt"
FROM "ProcesoResponsable"
LIMIT 5;

-- 6. Contar registros por modo
SELECT 
    modo,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
GROUP BY modo
ORDER BY modo;
