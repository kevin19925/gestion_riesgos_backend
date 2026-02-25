-- Índices para consultas rápidas (Riesgo, CausaRiesgo, Incidencia)
-- Ejecutar manualmente cuando hay "drift" y no quieres usar migrate reset (evita perder datos).
--
-- Opción 1 - psql (desde la carpeta del backend):
--   En Windows PowerShell: Get-Content .\scripts\add_indexes_consultas.sql | psql $env:DATABASE_URL
--   En bash: psql "$DATABASE_URL" -f scripts/add_indexes_consultas.sql
--
-- Opción 2 - Copiar y pegar este contenido en la consola SQL de Render (o tu proveedor).
--

-- Riesgo: filtros por proceso y orden por fecha
CREATE INDEX IF NOT EXISTS "Riesgo_procesoId_idx" ON "Riesgo"("procesoId");
CREATE INDEX IF NOT EXISTS "Riesgo_createdAt_idx" ON "Riesgo"("createdAt");

-- CausaRiesgo: cargar causas por riesgo
CREATE INDEX IF NOT EXISTS "CausaRiesgo_riesgoId_idx" ON "CausaRiesgo"("riesgoId");

-- Incidencia: listados y filtros
CREATE INDEX IF NOT EXISTS "Incidencia_procesoId_idx" ON "Incidencia"("procesoId");
CREATE INDEX IF NOT EXISTS "Incidencia_riesgoId_idx" ON "Incidencia"("riesgoId");
CREATE INDEX IF NOT EXISTS "Incidencia_fechaOcurrencia_idx" ON "Incidencia"("fechaOcurrencia");
