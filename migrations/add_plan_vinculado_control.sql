-- Migración: Agregar campo planAccionVinculadoId a ControlRiesgo
-- Fecha: 2024
-- Descripción: Permite vincular un control con un plan de acción específico del riesgo/causa

-- Agregar columna planAccionVinculadoId a la tabla ControlRiesgo
ALTER TABLE "ControlRiesgo" 
ADD COLUMN IF NOT EXISTS "planAccionVinculadoId" INTEGER;

-- Agregar índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS "ControlRiesgo_planAccionVinculadoId_idx" 
ON "ControlRiesgo"("planAccionVinculadoId");

-- Agregar foreign key constraint (opcional, pero recomendado)
ALTER TABLE "ControlRiesgo"
ADD CONSTRAINT "ControlRiesgo_planAccionVinculadoId_fkey" 
FOREIGN KEY ("planAccionVinculadoId") 
REFERENCES "PlanAccion"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Comentario sobre la columna
COMMENT ON COLUMN "ControlRiesgo"."planAccionVinculadoId" IS 'ID del plan de acción vinculado a este control (si aplica)';
