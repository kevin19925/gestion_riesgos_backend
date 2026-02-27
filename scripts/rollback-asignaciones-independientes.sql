-- ============================================================================
-- ROLLBACK: Asignaciones Independientes por Modo
-- ============================================================================
-- Este script revierte los cambios de la migración en caso de problemas
-- ============================================================================

BEGIN;

RAISE NOTICE '=== INICIANDO ROLLBACK ===';

-- ============================================================================
-- PASO 1: RESTAURAR CONSTRAINT ORIGINAL
-- ============================================================================
-- Eliminar constraint nuevo
ALTER TABLE "ProcesoResponsable" 
DROP CONSTRAINT IF EXISTS "ProcesoResponsable_procesoId_usuarioId_modo_key";

-- Restaurar constraint original (sin modo)
ALTER TABLE "ProcesoResponsable" 
ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_key" 
UNIQUE ("procesoId", "usuarioId");

RAISE NOTICE 'Constraint restaurado a versión original';

-- ============================================================================
-- PASO 2: HACER CAMPO MODO OPCIONAL (NULLABLE)
-- ============================================================================
ALTER TABLE "ProcesoResponsable" 
ALTER COLUMN "modo" DROP NOT NULL;

RAISE NOTICE 'Campo modo ahora es opcional';

-- ============================================================================
-- PASO 3: CONSOLIDAR REGISTROS DUPLICADOS
-- ============================================================================
-- Eliminar duplicados manteniendo solo uno por (procesoId, usuarioId)
-- Prioridad: mantener el registro más reciente

DELETE FROM "ProcesoResponsable" a
USING "ProcesoResponsable" b
WHERE a.id < b.id 
AND a."procesoId" = b."procesoId" 
AND a."usuarioId" = b."usuarioId";

RAISE NOTICE 'Registros duplicados eliminados';

-- ============================================================================
-- PASO 4: ACTUALIZAR MODO A "AMBOS" PARA REGISTROS RESTANTES
-- ============================================================================
UPDATE "ProcesoResponsable"
SET "modo" = 'ambos'
WHERE "modo" IN ('director', 'proceso');

RAISE NOTICE 'Modo actualizado a "ambos" para todos los registros';

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================
DO $$
DECLARE
    total_registros INTEGER;
    registros_ambos INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_registros FROM "ProcesoResponsable";
    SELECT COUNT(*) INTO registros_ambos FROM "ProcesoResponsable" WHERE modo = 'ambos';
    
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
    RAISE NOTICE 'Total de registros: %', total_registros;
    RAISE NOTICE 'Registros con modo "ambos": %', registros_ambos;
    RAISE NOTICE '=== ROLLBACK COMPLETADO ===';
END $$;

COMMIT;

-- ============================================================================
-- NOTA: Después de ejecutar este rollback, el sistema volverá al estado
--       anterior donde las asignaciones se sincronizan automáticamente
-- ============================================================================
