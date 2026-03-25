-- PlanAccion: seguimiento tras fecha de finalización (URLs en blob; columnas nuevas, sin tocar datos existentes)
ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "fechaFinalizacion" TIMESTAMP(3);
ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "seguimientoDetalle" TEXT;
ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "seguimientoEvidenciaUrl1" TEXT;
ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "seguimientoEvidenciaUrl2" TEXT;
