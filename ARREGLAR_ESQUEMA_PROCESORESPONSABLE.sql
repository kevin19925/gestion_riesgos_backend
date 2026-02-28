-- ============================================
-- SCRIPT: Arreglar esquema de ProcesoResponsable
-- ============================================
-- Este script verifica y arregla problemas comunes con la tabla ProcesoResponsable
-- Ejecutar en pgAdmin

-- PASO 1: Verificar estructura actual
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ProcesoResponsable'
ORDER BY ordinal_position;

-- PASO 2: Verificar si la columna 'modo' existe y es NOT NULL
-- Si modo es nullable, necesitamos arreglarlo

-- PASO 3: Verificar constraint unique
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'ProcesoResponsable'
  AND constraint_type = 'UNIQUE';

-- ============================================
-- ARREGLOS (ejecutar solo si es necesario)
-- ============================================

-- A. Si la columna 'modo' no existe, crearla:
-- ALTER TABLE "ProcesoResponsable" ADD COLUMN modo VARCHAR(20);

-- B. Si 'modo' existe pero es NULL, actualizarla:
-- UPDATE "ProcesoResponsable" SET modo = 'proceso' WHERE modo IS NULL;

-- C. Si 'modo' no es NOT NULL, hacerla obligatoria:
-- ALTER TABLE "ProcesoResponsable" ALTER COLUMN modo SET NOT NULL;

-- D. Si el constraint unique no incluye 'modo', eliminarlo y recrearlo:
-- Primero, ver el nombre del constraint actual:
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'ProcesoResponsable'
  AND constraint_type = 'UNIQUE';

-- Luego, eliminarlo (reemplazar NOMBRE_CONSTRAINT con el nombre real):
-- ALTER TABLE "ProcesoResponsable" DROP CONSTRAINT "NOMBRE_CONSTRAINT";

-- Y recrearlo con modo incluido:
-- ALTER TABLE "ProcesoResponsable" 
-- ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_modo_key" 
-- UNIQUE ("procesoId", "usuarioId", modo);

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Ver todos los registros actuales
SELECT * FROM "ProcesoResponsable" ORDER BY id;

-- Contar registros por modo
SELECT modo, COUNT(*) as cantidad
FROM "ProcesoResponsable"
GROUP BY modo;
