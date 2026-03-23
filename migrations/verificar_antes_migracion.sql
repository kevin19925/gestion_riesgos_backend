-- =====================================================
-- SCRIPT DE VERIFICACIÓN PRE-MIGRACIÓN
-- Ejecuta esto ANTES de aplicar la migración
-- =====================================================

-- 1. Verificar estructura actual de PlanAccion
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'PlanAccion'
ORDER BY ordinal_position;

-- 2. Verificar estructura actual de Control
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'Control'
ORDER BY ordinal_position;

-- 3. Contar registros actuales
SELECT 
    'PlanAccion' as tabla,
    COUNT(*) as total_registros
FROM "PlanAccion"
UNION ALL
SELECT 
    'Control' as tabla,
    COUNT(*) as total_registros
FROM "Control";

-- 4. Verificar si ya existen las columnas nuevas
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'PlanAccion' AND column_name = 'controlDerivadoId'
        ) THEN '⚠️  Ya existe'
        ELSE '✅ No existe (OK para migrar)'
    END as "PlanAccion.controlDerivadoId",
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Control' AND column_name = 'planAccionOrigenId'
        ) THEN '⚠️  Ya existe'
        ELSE '✅ No existe (OK para migrar)'
    END as "Control.planAccionOrigenId",
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'AlertaVencimiento'
        ) THEN '⚠️  Ya existe'
        ELSE '✅ No existe (OK para migrar)'
    END as "Tabla AlertaVencimiento";

-- 5. Verificar distribución de estados actuales en PlanAccion
SELECT 
    estado,
    COUNT(*) as cantidad,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM "PlanAccion"
GROUP BY estado
ORDER BY cantidad DESC;

-- 6. Verificar planes con porcentajeAvance
SELECT 
    CASE 
        WHEN "porcentajeAvance" = 100 THEN 'Completados (100%)'
        WHEN "porcentajeAvance" > 0 AND "porcentajeAvance" < 100 THEN 'En progreso (1-99%)'
        WHEN "porcentajeAvance" = 0 OR "porcentajeAvance" IS NULL THEN 'Sin iniciar (0% o NULL)'
    END as categoria,
    COUNT(*) as cantidad
FROM "PlanAccion"
GROUP BY 
    CASE 
        WHEN "porcentajeAvance" = 100 THEN 'Completados (100%)'
        WHEN "porcentajeAvance" > 0 AND "porcentajeAvance" < 100 THEN 'En progreso (1-99%)'
        WHEN "porcentajeAvance" = 0 OR "porcentajeAvance" IS NULL THEN 'Sin iniciar (0% o NULL)'
    END
ORDER BY cantidad DESC;

-- 7. Verificar planes próximos a vencer o vencidos
SELECT 
    CASE 
        WHEN "fechaProgramada" < CURRENT_DATE THEN 'Vencidos'
        WHEN "fechaProgramada" BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 'Próximos a vencer (7 días)'
        ELSE 'Futuros'
    END as categoria_vencimiento,
    COUNT(*) as cantidad
FROM "PlanAccion"
WHERE "fechaProgramada" IS NOT NULL
GROUP BY 
    CASE 
        WHEN "fechaProgramada" < CURRENT_DATE THEN 'Vencidos'
        WHEN "fechaProgramada" BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 'Próximos a vencer (7 días)'
        ELSE 'Futuros'
    END
ORDER BY 
    CASE 
        WHEN "fechaProgramada" < CURRENT_DATE THEN 1
        WHEN "fechaProgramada" BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 2
        ELSE 3
    END;

-- =====================================================
-- RESUMEN DE VERIFICACIÓN
-- =====================================================

SELECT 
    '✅ LISTO PARA MIGRAR' as estado,
    'Todos los checks pasaron correctamente' as mensaje
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'PlanAccion' AND column_name = 'controlDerivadoId'
)
AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'AlertaVencimiento'
);
