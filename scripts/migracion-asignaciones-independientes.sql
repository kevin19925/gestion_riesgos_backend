-- ============================================================================
-- MIGRACIÓN: Asignaciones Independientes por Modo
-- ============================================================================
-- Objetivo: Permitir que un usuario tenga diferentes procesos asignados
--           en "Modo Director" vs "Modo Proceso" sin sincronización automática
--
-- Cambio principal: Modificar constraint único para incluir campo "modo"
--   ANTES: UNIQUE(procesoId, usuarioId)
--   DESPUÉS: UNIQUE(procesoId, usuarioId, modo)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=== INICIANDO MIGRACIÓN ===';
    RAISE NOTICE 'Fecha: %', NOW();
    
    -- Contar registros actuales
    RAISE NOTICE 'Registros actuales en ProcesoResponsable: %', 
        (SELECT COUNT(*) FROM "ProcesoResponsable");
    
    -- Contar registros con modo "ambos" o NULL
    RAISE NOTICE 'Registros con modo "ambos" o NULL: %', 
        (SELECT COUNT(*) FROM "ProcesoResponsable" WHERE modo = 'ambos' OR modo IS NULL);
END $$;

-- ============================================================================
-- PASO 2: DUPLICAR REGISTROS EXISTENTES PARA AMBOS MODOS
-- ============================================================================
-- Los registros con modo "ambos" o NULL se duplicarán:
-- - Un registro con modo = 'director'
-- - Un registro con modo = 'proceso'
-- ============================================================================

-- 2.1: Crear registros para modo "director"
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT "procesoId", "usuarioId", 'director', "createdAt"
FROM "ProcesoResponsable"
WHERE "modo" = 'ambos' OR "modo" IS NULL;

-- 2.2: Crear registros para modo "proceso"
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT "procesoId", "usuarioId", 'proceso', "createdAt"
FROM "ProcesoResponsable"
WHERE "modo" = 'ambos' OR "modo" IS NULL;

-- Verificar duplicación
DO $$
BEGIN
    RAISE NOTICE 'Registros después de duplicación: %', 
        (SELECT COUNT(*) FROM "ProcesoResponsable");
END $$;

-- ============================================================================
-- PASO 3: ELIMINAR REGISTROS ANTIGUOS CON MODO "AMBOS" O NULL
-- ============================================================================
DELETE FROM "ProcesoResponsable" 
WHERE "modo" = 'ambos' OR "modo" IS NULL;

-- Verificar eliminación
DO $$
BEGIN
    RAISE NOTICE 'Registros después de limpieza: %', 
        (SELECT COUNT(*) FROM "ProcesoResponsable");
    RAISE NOTICE 'Registros con modo "ambos" o NULL restantes: %', 
        (SELECT COUNT(*) FROM "ProcesoResponsable" WHERE modo = 'ambos' OR modo IS NULL);
END $$;

-- ============================================================================
-- PASO 4: MODIFICAR CONSTRAINT ÚNICO
-- ============================================================================
-- Eliminar constraint actual que solo incluye (procesoId, usuarioId)
ALTER TABLE "ProcesoResponsable" 
DROP CONSTRAINT IF EXISTS "ProcesoResponsable_procesoId_usuarioId_key";

-- Crear nuevo constraint que incluye modo
ALTER TABLE "ProcesoResponsable" 
ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_modo_key" 
UNIQUE ("procesoId", "usuarioId", "modo");

RAISE NOTICE 'Constraint modificado exitosamente';

-- ============================================================================
-- PASO 5: HACER CAMPO MODO OBLIGATORIO (NOT NULL)
-- ============================================================================
ALTER TABLE "ProcesoResponsable" 
ALTER COLUMN "modo" SET NOT NULL;

RAISE NOTICE 'Campo modo ahora es NOT NULL';

-- ============================================================================
-- PASO 6: VERIFICACIÓN FINAL
-- ============================================================================
DO $$
DECLARE
    total_registros INTEGER;
    registros_director INTEGER;
    registros_proceso INTEGER;
    registros_sin_modo INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_registros FROM "ProcesoResponsable";
    SELECT COUNT(*) INTO registros_director FROM "ProcesoResponsable" WHERE modo = 'director';
    SELECT COUNT(*) INTO registros_proceso FROM "ProcesoResponsable" WHERE modo = 'proceso';
    SELECT COUNT(*) INTO registros_sin_modo FROM "ProcesoResponsable" WHERE modo IS NULL;
    
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
    RAISE NOTICE 'Total de registros: %', total_registros;
    RAISE NOTICE 'Registros con modo "director": %', registros_director;
    RAISE NOTICE 'Registros con modo "proceso": %', registros_proceso;
    RAISE NOTICE 'Registros sin modo (debe ser 0): %', registros_sin_modo;
    
    IF registros_sin_modo > 0 THEN
        RAISE EXCEPTION 'ERROR: Aún existen registros sin modo';
    END IF;
    
    RAISE NOTICE '=== MIGRACIÓN COMPLETADA EXITOSAMENTE ===';
END $$;

-- ============================================================================
-- VERIFICAR CONSTRAINTS FINALES
-- ============================================================================
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'ProcesoResponsable'
AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type;

COMMIT;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Esta migración duplica los registros existentes para ambos modos
-- 2. Después de la migración, los usuarios podrán tener asignaciones diferentes
--    en cada modo sin sincronización automática
-- 3. El constraint nuevo permite:
--    ✅ Proceso 1 + Usuario 5 + Modo "director"
--    ✅ Proceso 1 + Usuario 5 + Modo "proceso"
--    ❌ Proceso 1 + Usuario 5 + Modo "director" (duplicado)
-- 4. Si algo falla, ejecutar ROLLBACK para revertir todos los cambios
-- ============================================================================
