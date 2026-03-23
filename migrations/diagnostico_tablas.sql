-- =====================================================
-- DIAGNÓSTICO: Encontrar las tablas reales en la BD
-- =====================================================

-- PASO 1: Listar TODAS las tablas en la base de datos
-- Ejecuta esto primero para ver qué tablas existen
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- PASO 2: Buscar tablas relacionadas con planes y controles
SELECT 
    table_name,
    CASE 
        WHEN LOWER(table_name) LIKE '%plan%' THEN '📋 PLAN'
        WHEN LOWER(table_name) LIKE '%control%' THEN '🎛️ CONTROL'
        WHEN LOWER(table_name) LIKE '%accion%' THEN '⚡ ACCION'
        WHEN LOWER(table_name) LIKE '%riesgo%' THEN '⚠️ RIESGO'
        ELSE '📁 OTRA'
    END as categoria
FROM information_schema.tables 
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND (
        LOWER(table_name) LIKE '%plan%' 
        OR LOWER(table_name) LIKE '%control%'
        OR LOWER(table_name) LIKE '%accion%'
        OR LOWER(table_name) LIKE '%riesgo%'
    )
ORDER BY categoria, table_name;

-- PASO 3: Contar registros en TODAS las tablas
-- Esto te mostrará qué tablas tienen datos
SELECT 
    schemaname,
    tablename,
    n_live_tup as registros_aproximados
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND n_live_tup > 0
ORDER BY n_live_tup DESC;

-- PASO 4: Verificar tabla PlanAccion (con comillas)
-- Si esta query falla, la tabla no existe con ese nombre
SELECT 
    'PlanAccion' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN estado IS NOT NULL THEN 1 END) as con_estado,
    COUNT(CASE WHEN "porcentajeAvance" IS NOT NULL THEN 1 END) as con_porcentaje
FROM "PlanAccion";

-- PASO 5: Verificar tabla Control (con comillas)
SELECT 
    'Control' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN descripcion IS NOT NULL THEN 1 END) as con_descripcion,
    COUNT(CASE WHEN "riesgoId" IS NOT NULL THEN 1 END) as con_riesgo
FROM "Control";

-- PASO 6: Verificar tabla ControlRiesgo (alternativa común)
-- Esta tabla existe en el schema y podría ser la que estás viendo
SELECT 
    'ControlRiesgo' as tabla,
    COUNT(*) as total_registros,
    COUNT(CASE WHEN descripcion IS NOT NULL THEN 1 END) as con_descripcion
FROM "ControlRiesgo";

-- PASO 7: Ver estructura de PlanAccion
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'PlanAccion'
ORDER BY ordinal_position;

-- PASO 8: Ver estructura de Control
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Control'
ORDER BY ordinal_position;

-- PASO 9: Verificar relaciones (foreign keys)
SELECT
    tc.table_name as tabla_origen,
    kcu.column_name as columna_origen,
    ccu.table_name as tabla_destino,
    ccu.column_name as columna_destino
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (tc.table_name = 'PlanAccion' OR tc.table_name = 'Control')
ORDER BY tc.table_name;

-- PASO 10: Buscar datos de ejemplo en PlanAccion
-- Si esta query retorna datos, la tabla existe y tiene contenido
SELECT 
    id,
    descripcion,
    estado,
    "porcentajeAvance",
    "createdAt"
FROM "PlanAccion"
LIMIT 5;

-- PASO 11: Buscar datos de ejemplo en Control
SELECT 
    id,
    descripcion,
    "tipoControl",
    efectividad,
    "createdAt"
FROM "Control"
LIMIT 5;
