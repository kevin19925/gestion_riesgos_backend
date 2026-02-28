-- Verificar estructura de la tabla ProcesoResponsable
-- Ejecutar en pgAdmin para diagnosticar problemas

-- 1. Ver la estructura completa de la tabla
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ProcesoResponsable'
ORDER BY ordinal_position;

-- 2. Ver los constraints (unique, foreign keys, etc.)
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'ProcesoResponsable'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 3. Ver los índices
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'ProcesoResponsable';

-- 4. Verificar si hay registros con modo NULL (no debería haber)
SELECT COUNT(*) as registros_con_modo_null
FROM "ProcesoResponsable"
WHERE modo IS NULL;

-- 5. Ver valores únicos de modo
SELECT 
    modo,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
GROUP BY modo
ORDER BY cantidad DESC;

-- 6. Intentar insertar un registro de prueba (esto fallará si hay problemas)
-- NOTA: Cambiar los IDs por valores reales de tu base de datos
-- NO EJECUTAR ESTO, SOLO PARA REFERENCIA:
-- INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", modo, "createdAt")
-- VALUES (11, 101, 'proceso', NOW());

-- 7. Ver si hay problemas con la secuencia de autoincremento
SELECT 
    last_value,
    is_called
FROM "ProcesoResponsable_id_seq";
