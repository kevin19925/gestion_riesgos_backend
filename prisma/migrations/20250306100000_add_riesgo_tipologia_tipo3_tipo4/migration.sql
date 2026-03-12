-- AlterTable: add Tipología tipo III and IV (manual text) to Riesgo
ALTER TABLE "Riesgo" ADD COLUMN IF NOT EXISTS "tipologiaTipo3" TEXT;
ALTER TABLE "Riesgo" ADD COLUMN IF NOT EXISTS "tipologiaTipo4" TEXT;
