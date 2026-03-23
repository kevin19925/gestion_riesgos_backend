-- =====================================================
-- MIGRACIÓN: Trazabilidad y Evolución de Planes de Acción
-- Fecha: 2024-03-22
-- Descripción: Agrega campos para trazabilidad entre planes y controles,
--              y crea tabla de alertas de vencimiento
-- =====================================================

-- IMPORTANTE: Esta migración es SEGURA y NO DESTRUCTIVA
-- - Todos los campos nuevos son opcionales (nullable)
-- - No modifica datos existentes
-- - No elimina columnas
-- - Código existente seguirá funcionando sin cambios

BEGIN;

-- =====================================================
-- PASO 1: Agregar campos de trazabilidad a PlanAccion
-- =====================================================

-- Campo para referenciar el control derivado (si fue convertido)
ALTER TABLE "PlanAccion" 
ADD COLUMN IF NOT EXISTS "controlDerivadoId" INTEGER;

-- Fecha en que el plan fue convertido a control
ALTER TABLE "PlanAccion" 
ADD COLUMN IF NOT EXISTS "fechaConversion" TIMESTAMP(3);

-- Crear constraint de unicidad para controlDerivadoId
ALTER TABLE "PlanAccion" 
ADD CONSTRAINT "PlanAccion_controlDerivadoId_key" 
UNIQUE ("controlDerivadoId");

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS "PlanAccion_estado_idx" 
ON "PlanAccion"("estado");

CREATE INDEX IF NOT EXISTS "PlanAccion_fechaProgramada_idx" 
ON "PlanAccion"("fechaProgramada");

CREATE INDEX IF NOT EXISTS "PlanAccion_controlDerivadoId_idx" 
ON "PlanAccion"("controlDerivadoId");

-- =====================================================
-- PASO 2: Agregar campos de origen a Control
-- =====================================================

-- Campo para referenciar el plan de acción origen (si fue creado desde un plan)
ALTER TABLE "Control" 
ADD COLUMN IF NOT EXISTS "planAccionOrigenId" INTEGER;

-- Fecha en que el control fue creado desde un plan
ALTER TABLE "Control" 
ADD COLUMN IF NOT EXISTS "fechaCreacionDesdePlan" TIMESTAMP(3);

-- Crear constraint de unicidad para planAccionOrigenId
ALTER TABLE "Control" 
ADD CONSTRAINT "Control_planAccionOrigenId_key" 
UNIQUE ("planAccionOrigenId");

-- Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS "Control_planAccionOrigenId_idx" 
ON "Control"("planAccionOrigenId");

-- =====================================================
-- PASO 3: Crear tabla AlertaVencimiento
-- =====================================================

CREATE TABLE IF NOT EXISTS "AlertaVencimiento" (
    "id" SERIAL PRIMARY KEY,
    "planAccionId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,  -- "proximo" | "vencido"
    "diasRestantes" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLectura" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT "AlertaVencimiento_planAccionId_fkey" 
        FOREIGN KEY ("planAccionId") 
        REFERENCES "PlanAccion"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT "AlertaVencimiento_usuarioId_fkey" 
        FOREIGN KEY ("usuarioId") 
        REFERENCES "Usuario"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Índices para AlertaVencimiento
CREATE INDEX IF NOT EXISTS "AlertaVencimiento_planAccionId_idx" 
ON "AlertaVencimiento"("planAccionId");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_usuarioId_idx" 
ON "AlertaVencimiento"("usuarioId");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_leida_idx" 
ON "AlertaVencimiento"("leida");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_fechaGeneracion_idx" 
ON "AlertaVencimiento"("fechaGeneracion");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_tipo_idx" 
ON "AlertaVencimiento"("tipo");

-- =====================================================
-- PASO 4: Agregar foreign keys para relaciones bidireccionales
-- =====================================================

-- Relación PlanAccion -> Control (controlDerivado)
ALTER TABLE "PlanAccion" 
ADD CONSTRAINT "PlanAccion_controlDerivadoId_fkey" 
FOREIGN KEY ("controlDerivadoId") 
REFERENCES "Control"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Relación Control -> PlanAccion (planAccionOrigen)
ALTER TABLE "Control" 
ADD CONSTRAINT "Control_planAccionOrigenId_fkey" 
FOREIGN KEY ("planAccionOrigenId") 
REFERENCES "PlanAccion"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

COMMIT;

-- =====================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Verificar que las columnas se agregaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'PlanAccion' 
    AND column_name IN ('controlDerivadoId', 'fechaConversion')
ORDER BY column_name;

SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Control' 
    AND column_name IN ('planAccionOrigenId', 'fechaCreacionDesdePlan')
ORDER BY column_name;

-- Verificar que la tabla AlertaVencimiento existe
SELECT COUNT(*) as total_alertas FROM "AlertaVencimiento";

-- Verificar que los índices se crearon
SELECT 
    indexname, 
    tablename 
FROM pg_indexes 
WHERE tablename IN ('PlanAccion', 'Control', 'AlertaVencimiento')
    AND indexname LIKE '%trazabilidad%' OR indexname LIKE '%Alerta%'
ORDER BY tablename, indexname;

-- =====================================================
-- ROLLBACK (En caso de necesitar revertir)
-- =====================================================

-- DESCOMENTAR Y EJECUTAR SOLO SI NECESITAS REVERTIR:

/*
BEGIN;

-- Eliminar tabla AlertaVencimiento
DROP TABLE IF EXISTS "AlertaVencimiento" CASCADE;

-- Eliminar foreign keys
ALTER TABLE "PlanAccion" DROP CONSTRAINT IF EXISTS "PlanAccion_controlDerivadoId_fkey";
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_planAccionOrigenId_fkey";

-- Eliminar índices
DROP INDEX IF EXISTS "PlanAccion_estado_idx";
DROP INDEX IF EXISTS "PlanAccion_fechaProgramada_idx";
DROP INDEX IF EXISTS "PlanAccion_controlDerivadoId_idx";
DROP INDEX IF EXISTS "Control_planAccionOrigenId_idx";

-- Eliminar constraints de unicidad
ALTER TABLE "PlanAccion" DROP CONSTRAINT IF EXISTS "PlanAccion_controlDerivadoId_key";
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_planAccionOrigenId_key";

-- Eliminar columnas
ALTER TABLE "PlanAccion" DROP COLUMN IF EXISTS "controlDerivadoId";
ALTER TABLE "PlanAccion" DROP COLUMN IF EXISTS "fechaConversion";
ALTER TABLE "Control" DROP COLUMN IF EXISTS "planAccionOrigenId";
ALTER TABLE "Control" DROP COLUMN IF EXISTS "fechaCreacionDesdePlan";

COMMIT;
*/
