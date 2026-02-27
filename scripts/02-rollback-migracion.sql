-- ============================================
-- ROLLBACK: Revertir Migración de Modo Independiente
-- ============================================
-- Este script revierte los cambios de la migración
-- y restaura el comportamiento anterior (modo "ambos")
--
-- USAR SOLO SI LA MIGRACIÓN FALLA O NECESITAS REVERTIR
-- ============================================

BEGIN;

RAISE NOTICE '=== INICIANDO ROLLBACK ===';

-- ============================================
-- PASO 1: Verificar estado actual
-- ============================================
DO $$
DECLARE
    v_count_total INTEGER;
    v_count_director INTEGER;
    v_count_proceso INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_total FROM "ProcesoResponsable";
    SELECT COUNT(*) INTO v_count_director FROM "ProcesoResponsable" WHERE modo = 'director';
    SELECT COUNT(*) INTO v_count_proceso FROM "ProcesoResponsable" WHERE modo = 'proceso';
    
    RAISE NOTICE 'Estado actual:';
    RAISE NOTICE '  Total registros: %', v_count_total;
    RAISE NOTICE '  Modo "director": %', v_count_director;
    RAISE NOTICE '  Modo "proceso": %', v_count_proceso;
END $$;

-- ============================================
-- PASO 2: Hacer campo modo nullable
-- ============================================
RAISE NOTICE '=== HACIENDO CAMPO MODO NULLABLE ===';

ALTER TABLE "ProcesoResponsable" 
ALTER COLUMN "modo" DROP NOT NULL;

-- ============================================
-- PASO 3: Eliminar constraint nuevo
-- ============================================
RAISE NOTICE '=== ELIMINANDO CONSTRAINT NUEVO ===';

ALTER TABLE "ProcesoResponsable" 
DROP CONSTRAINT IF EXISTS "ProcesoResponsable_procesoId_usuarioId_modo_key";

-- ============================================
-- PASO 4: Consolidar registros duplicados
-- ============================================
RAISE NOTICE '=== CONSOLIDANDO REGISTROS ===';

-- Crear tabla temporal con registros únicos (modo "ambos")
CREATE TEMP TABLE temp_responsables AS
SELECT DISTINCT ON ("procesoId", "usuarioId")
    "procesoId",
    "usuarioId",
    'ambos'::VARCHAR(20) as modo,
    MIN("createdAt") as "createdAt"
FROM "ProcesoResponsable"
WHERE modo IN ('director', 'proceso')
GROUP BY "procesoId", "usuarioId";

-- Eliminar todos los registros con modo director/proceso
DELETE FROM "ProcesoResponsable" 
WHERE modo IN ('director', 'proceso');

-- Insertar registros consolidados
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT "procesoId", "usuarioId", modo, "createdAt"
FROM temp_responsables;

-- Limpiar tabla temporal
DROP TABLE temp_responsables;

-- ============================================
-- PASO 5: Restaurar constraint original
-- ============================================
RAISE NOTICE '=== RESTAURANDO CONSTRAINT ORIGINAL ===';

ALTER TABLE "ProcesoResponsable" 
ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_key" 
UNIQUE ("procesoId", "usuarioId");

-- ============================================
-- PASO 6: Verificar resultado
-- ============================================
DO $$
DECLARE
    v_count_total INTEGER;
    v_count_ambos INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_total FROM "ProcesoResponsable";
    SELECT COUNT(*) INTO v_count_ambos FROM "ProcesoResponsable" WHERE modo = 'ambos';
    
    RAISE NOTICE '=== RESULTADO ROLLBACK ===';
    RAISE NOTICE 'Total registros: %', v_count_total;
    RAISE NOTICE 'Registros con modo "ambos": %', v_count_ambos;
    
    IF v_count_ambos = v_count_total THEN
        RAISE NOTICE '✓ Rollback completado exitosamente';
    ELSE
        RAISE WARNING 'Advertencia: No todos los registros tienen modo "ambos"';
    END IF;
END $$;

COMMIT;

RAISE NOTICE '=== ROLLBACK FINALIZADO ===';
RAISE NOTICE 'El sistema ha vuelto al estado anterior (modo "ambos")';
