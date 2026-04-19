-- Índices adicionales (consultas por proceso+clasificación, incidencias, planes, config residual).
-- Sin cambiar columnas ni datos. IF NOT EXISTS permite re-ejecutar sin error.

-- Área / proceso
CREATE INDEX IF NOT EXISTS "Area_directorId_idx" ON "Area" ("directorId");
CREATE INDEX IF NOT EXISTS "Proceso_activo_idx" ON "Proceso" ("activo");
CREATE INDEX IF NOT EXISTS "Proceso_areaId_estado_idx" ON "Proceso" ("areaId", "estado");

-- Riesgo: filtros mapa/listados por proceso + consecuencia; orden por actualización
CREATE INDEX IF NOT EXISTS "Riesgo_procesoId_clasificacion_idx" ON "Riesgo" ("procesoId", "clasificacion");
CREATE INDEX IF NOT EXISTS "Riesgo_updatedAt_idx" ON "Riesgo" ("updatedAt");

-- Plan de acción: listados por riesgo y estado
CREATE INDEX IF NOT EXISTS "PlanAccion_riesgoId_estado_idx" ON "PlanAccion" ("riesgoId", "estado");
CREATE INDEX IF NOT EXISTS "PlanAccion_createdAt_idx" ON "PlanAccion" ("createdAt");

-- Incidencias
CREATE INDEX IF NOT EXISTS "Incidencia_estado_idx" ON "Incidencia" ("estado");
CREATE INDEX IF NOT EXISTS "Incidencia_responsableId_idx" ON "Incidencia" ("responsableId");
CREATE INDEX IF NOT EXISTS "Incidencia_procesoId_estado_idx" ON "Incidencia" ("procesoId", "estado");

-- Tipología
CREATE INDEX IF NOT EXISTS "SubtipoRiesgo_tipoRiesgoId_idx" ON "SubtipoRiesgo" ("tipoRiesgoId");

-- Configuración residual: hijos por configId
CREATE INDEX IF NOT EXISTS "PesoCriterioResidual_configId_idx" ON "PesoCriterioResidual" ("configId");
CREATE INDEX IF NOT EXISTS "RangoEvaluacionResidual_configId_idx" ON "RangoEvaluacionResidual" ("configId");
CREATE INDEX IF NOT EXISTS "TablaMitigacionResidual_configId_idx" ON "TablaMitigacionResidual" ("configId");
CREATE INDEX IF NOT EXISTS "OpcionCriterioResidual_configId_idx" ON "OpcionCriterioResidual" ("configId");
CREATE INDEX IF NOT EXISTS "RangoNivelRiesgoResidual_configId_idx" ON "RangoNivelRiesgoResidual" ("configId");

-- Config activa (una fila típica por consulta)
CREATE INDEX IF NOT EXISTS "ConfiguracionResidual_activa_idx" ON "ConfiguracionResidual" ("activa");
CREATE INDEX IF NOT EXISTS "CalificacionInherenteConfig_activa_idx" ON "CalificacionInherenteConfig" ("activa");
