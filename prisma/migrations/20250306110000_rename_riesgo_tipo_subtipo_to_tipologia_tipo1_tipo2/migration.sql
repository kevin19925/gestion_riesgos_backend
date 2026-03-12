-- Renombrar columnas de Riesgo: tipo/subtipo -> tipología tipo I / tipología tipo II
ALTER TABLE "Riesgo" RENAME COLUMN "tipoRiesgoId" TO "tipologiaTipo1Id";
ALTER TABLE "Riesgo" RENAME COLUMN "subtipoRiesgoId" TO "tipologiaTipo2Id";
