-- Índices para acelerar filtros y joins frecuentes.
-- No altera columnas ni datos; solo añade índices en PostgreSQL.

-- Proceso: listados y filtros por área, responsable, estado
CREATE INDEX IF NOT EXISTS "Proceso_areaId_idx" ON "Proceso" ("areaId");
CREATE INDEX IF NOT EXISTS "Proceso_responsableId_idx" ON "Proceso" ("responsableId");
CREATE INDEX IF NOT EXISTS "Proceso_estado_idx" ON "Proceso" ("estado");

-- Riesgo: por proceso ordenado por antigüedad; filtros por clasificación y tipología
CREATE INDEX IF NOT EXISTS "Riesgo_procesoId_createdAt_idx" ON "Riesgo" ("procesoId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Riesgo_clasificacion_idx" ON "Riesgo" ("clasificacion");
CREATE INDEX IF NOT EXISTS "Riesgo_tipologiaTipo1Id_idx" ON "Riesgo" ("tipologiaTipo1Id");
CREATE INDEX IF NOT EXISTS "Riesgo_tipologiaTipo2Id_idx" ON "Riesgo" ("tipologiaTipo2Id");
CREATE INDEX IF NOT EXISTS "Riesgo_objetivoId_idx" ON "Riesgo" ("objetivoId");

-- ControlRiesgo: carga de controles por causa
CREATE INDEX IF NOT EXISTS "ControlRiesgo_causaRiesgoId_idx" ON "ControlRiesgo" ("causaRiesgoId");

-- EvaluacionRiesgo: filtros por nivel (mapas / reportes)
CREATE INDEX IF NOT EXISTS "EvaluacionRiesgo_nivelRiesgo_idx" ON "EvaluacionRiesgo" ("nivelRiesgo");
CREATE INDEX IF NOT EXISTS "EvaluacionRiesgo_nivelRiesgoResidual_idx" ON "EvaluacionRiesgo" ("nivelRiesgoResidual");

-- PlanAccion: planes por riesgo, incidencia, priorización y estado
CREATE INDEX IF NOT EXISTS "PlanAccion_riesgoId_idx" ON "PlanAccion" ("riesgoId");
CREATE INDEX IF NOT EXISTS "PlanAccion_incidenciaId_idx" ON "PlanAccion" ("incidenciaId");
CREATE INDEX IF NOT EXISTS "PlanAccion_priorizacionId_idx" ON "PlanAccion" ("priorizacionId");
CREATE INDEX IF NOT EXISTS "PlanAccion_estado_idx" ON "PlanAccion" ("estado");

-- Usuario: auth y listados por rol / cargo / activo
CREATE INDEX IF NOT EXISTS "Usuario_roleId_idx" ON "Usuario" ("roleId");
CREATE INDEX IF NOT EXISTS "Usuario_cargoId_idx" ON "Usuario" ("cargoId");
CREATE INDEX IF NOT EXISTS "Usuario_activo_idx" ON "Usuario" ("activo");

-- HistorialEvento: consultas por usuario+fecha y por entidad
CREATE INDEX IF NOT EXISTS "HistorialEvento_usuarioId_fecha_idx" ON "HistorialEvento" ("usuarioId", "fecha");
CREATE INDEX IF NOT EXISTS "HistorialEvento_entidadTipo_entidadId_idx" ON "HistorialEvento" ("entidadTipo", "entidadId");
