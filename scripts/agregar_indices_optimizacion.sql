-- Script para agregar índices que mejoran el rendimiento de las queries de riesgos
-- Estos índices aceleran las búsquedas y filtros más comunes

-- Índice en procesoId (usado frecuentemente para filtrar)
CREATE INDEX IF NOT EXISTS "idx_riesgo_procesoId" ON "Riesgo"("procesoId");

-- Índice compuesto en procesoId y createdAt (para queries ordenadas por fecha)
CREATE INDEX IF NOT EXISTS "idx_riesgo_procesoId_createdAt" ON "Riesgo"("procesoId", "createdAt" DESC);

-- Índice en createdAt (para ordenamiento)
CREATE INDEX IF NOT EXISTS "idx_riesgo_createdAt" ON "Riesgo"("createdAt" DESC);

-- Índice en numeroIdentificacion (para búsquedas)
CREATE INDEX IF NOT EXISTS "idx_riesgo_numeroIdentificacion" ON "Riesgo"("numeroIdentificacion");

-- Índice en clasificacion (para filtros)
CREATE INDEX IF NOT EXISTS "idx_riesgo_clasificacion" ON "Riesgo"("clasificacion");

-- Índice en CausaRiesgo.riesgoId (para cargar causas por riesgo)
CREATE INDEX IF NOT EXISTS "idx_causaRiesgo_riesgoId" ON "CausaRiesgo"("riesgoId");

-- Índice en EvaluacionRiesgo.riesgoId (ya tiene unique, pero agregamos índice adicional si es necesario)
-- El unique ya crea un índice, pero podemos agregar uno compuesto si es necesario

-- Índice en CausaRiesgo para ordenamiento por id
CREATE INDEX IF NOT EXISTS "idx_causaRiesgo_id" ON "CausaRiesgo"("id");

-- Analizar tablas para optimizar estadísticas
ANALYZE "Riesgo";
ANALYZE "CausaRiesgo";
ANALYZE "EvaluacionRiesgo";

