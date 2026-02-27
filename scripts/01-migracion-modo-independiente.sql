-- ============================================
-- MIGRACIÓN: Asignaciones Independientes por Modo
-- ============================================
-- Este script permite que los usuarios tengan asignaciones diferentes
-- en Modo Director vs Modo Proceso
--
-- IMPORTANTE: 
-- 1. Hacer backup antes de ejecutar
-- 2. Ejecutar en horario de bajo tráfico
-- 3. Tiempo estimado: < 1 minuto
-- ============================================

BEGIN;

-- ============================================
-- PASO 1: Verificar estado actual
-- ============================================
DO $$
DECLARE
    v_count_ambos INTEGER;
    v_count_null INTEGER;
    v_count_total INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_ambos FROM "ProcesoResponsable" WHERE modo = 'ambos';
    SELECT COUNT(*) INTO v_count_null FROM "ProcesoResponsable" WHERE modo IS NULL;
    SELECT COUNT(*) INTO v_count_total FROM "ProcesoResponsable";
    
    RAISE NOTICE '=== ESTADO ACTUAL ===';
    RAISE NOTICE 'Total registros: %', v_count_total;
    RAISE NOTICE 'Registros con modo "ambos": %', v_count_ambos;
    RAISE NOTICE 'Registros con modo NULL: %', v_count_null;
    RAISE NOTICE 'Registros a migrar: %', v_count_ambos + v_count_null;
END $$;

-- ============================================
-- PASO 2: Duplicar registros existentes
-- ============================================
-- Los registros con modo "ambos" o NULL se duplicarán:
-- uno con modo "director" y otro con modo "proceso"

RAISE NOTICE '=== DUPLICANDO REGISTROS ===';

-- Crear registros para modo "director"
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT 
    "procesoId", 
    "usuarioId", 
    'director'::VARCHAR(20), 
    "createdAt"
FROM "ProcesoResponsable"
WHERE modo = 'ambos' OR modo IS NULL
ON CONFLICT DO NOTHING;

-- Crear registros para modo "proceso"
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT 
    "procesoId", 
    "usuarioId", 
    'proceso'::VARCHAR(20), 
    "createdAt"
FROM "ProcesoResponsable"
WHERE modo = 'ambos' OR modo IS NULL
ON CONFLICT DO NOTHING;

-- Verificar duplicación
DO $$
DECLARE
    v_count_director INTEGER;
    v_count_proceso INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_director FROM "ProcesoResponsable" WHERE modo = 'director';
    SELECT COUNT(*) INTO v_count_proceso FROM "ProcesoResponsable" WHERE modo = 'proceso';
    
    RAISE NOTICE 'Registros con modo "director": %', v_count_director;
    RAISE NOTICE 'Registros con modo "proceso": %', v_count_proceso;
END $$;

-- ============================================
-- PASO 3: Eliminar registros antiguos
-- ============================================
RAISE NOTICE '=== ELIMINANDO REGISTROS ANTIGUOS ===';

DELETE FROM "ProcesoResponsable" 
WHERE modo = 'ambos' OR modo IS NULL;

-- Verificar eliminación
DO $$
DECLARE
    v_count_restantes INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_restantes 
    FROM "ProcesoResponsable" 
    WHERE modo = 'ambos' OR modo IS NULL;
    
    IF v_count_restantes > 0 THEN
        RAISE EXCEPTION 'ERROR: Aún quedan % registros con modo "ambos" o NULL', v_count_restantes;
    ELSE
        RAISE NOTICE 'Registros antiguos eliminados correctamente';
    END IF;
END $$;

-- ============================================
-- PASO 4: Modificar constraint único
-- ============================================
RAISE NOTICE '=== MODIFICANDO CONSTRAINT ÚNICO ===';

-- Eliminar constraint actual (procesoId, usuarioId)
ALTER TABLE "ProcesoResponsable" 
DROP CONSTRAINT IF EXISTS "ProcesoResponsable_procesoId_usuarioId_key";

-- Agregar nuevo constraint (procesoId, usuarioId, modo)
ALTER TABLE "ProcesoResponsable" 
ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_modo_key" 
UNIQUE ("procesoId", "usuarioId", "modo");

RAISE NOTICE 'Constraint único actualizado: (procesoId, usuarioId, modo)';

-- ============================================
-- PASO 5: Hacer campo modo obligatorio
-- ============================================
RAISE NOTICE '=== HACIENDO CAMPO MODO OBLIGATORIO ===';

ALTER TABLE "ProcesoResponsable" 
ALTER COLUMN "modo" SET NOT NULL;

RAISE NOTICE 'Campo "modo" ahora es NOT NULL';

-- ============================================
-- PASO 6: Verificar resultado final
-- ============================================
DO $$
DECLARE
    v_count_total INTEGER;
    v_count_director INTEGER;
    v_count_proceso INTEGER;
    v_count_duplicados INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_total FROM "ProcesoResponsable";
    SELECT COUNT(*) INTO v_count_director FROM "ProcesoResponsable" WHERE modo = 'director';
    SELECT COUNT(*) INTO v_count_proceso FROM "ProcesoResponsable" WHERE modo = 'proceso';
    
    -- Verificar si hay duplicados (no debería haber)
    SELECT COUNT(*) INTO v_count_duplicados
    FROM (
        SELECT "procesoId", "usuarioId", modo, COUNT(*) as cnt
        FROM "ProcesoResponsable"
        GROUP BY "procesoId", "usuarioId", modo
        HAVING COUNT(*) > 1
    ) duplicados;
    
    RAISE NOTICE '=== RESULTADO FINAL ===';
    RAISE NOTICE 'Total registros: %', v_count_total;
    RAISE NOTICE 'Modo "director": %', v_count_director;
    RAISE NOTICE 'Modo "proceso": %', v_count_proceso;
    RAISE NOTICE 'Duplicados encontrados: %', v_count_duplicados;
    
    IF v_count_duplicados > 0 THEN
        RAISE EXCEPTION 'ERROR: Se encontraron registros duplicados';
    END IF;
    
    RAISE NOTICE '✓ Migración completada exitosamente';
END $$;

COMMIT;

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- Ejecutar estas queries después del COMMIT para verificar

-- Ver distribución de modos
SELECT 
    modo,
    COUNT(*) as cantidad,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM "ProcesoResponsable"
GROUP BY modo
ORDER BY modo;

-- Ver ejemplos de usuarios con asignaciones en ambos modos
SELECT 
    u.nombre,
    u.email,
    COUNT(DISTINCT pr."procesoId") as total_procesos,
    COUNT(DISTINCT CASE WHEN pr.modo = 'director' THEN pr."procesoId" END) as procesos_director,
    COUNT(DISTINCT CASE WHEN pr.modo = 'proceso' THEN pr."procesoId" END) as procesos_proceso
FROM "ProcesoResponsable" pr
JOIN "Usuario" u ON u.id = pr."usuarioId"
GROUP BY u.id, u.nombre, u.email
HAVING COUNT(DISTINCT pr.modo) = 2
LIMIT 10;
