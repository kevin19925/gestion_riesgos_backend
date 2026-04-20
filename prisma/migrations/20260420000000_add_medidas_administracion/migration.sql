-- Migration: add_medidas_administracion
-- Fecha: 2026-04-20
-- Descripción: Crea la tabla MedidaAdministracion para gestionar medidas
--              de administración de riesgos positivos (oportunidades estratégicas).
--              Solo AGREGA la nueva tabla y relaciones. NO modifica tablas existentes.

CREATE TABLE IF NOT EXISTS "MedidaAdministracion" (
    "id"                   SERIAL PRIMARY KEY,
    "causaRiesgoId"        INTEGER NOT NULL,
    "descripcion"          TEXT NOT NULL,
    "afecta"               VARCHAR(20),
    "presupuesto"          VARCHAR(20),
    "puntajePresupuesto"   DOUBLE PRECISION,
    "stakeholders"         VARCHAR(20),
    "puntajeStakeholders"  DOUBLE PRECISION,
    "entrenamiento"        VARCHAR(20),
    "puntajeEntrenamiento" DOUBLE PRECISION,
    "politicas"            VARCHAR(20),
    "puntajePoliticas"     DOUBLE PRECISION,
    "monitoreo"            VARCHAR(20),
    "puntajeMonitoreo"     DOUBLE PRECISION,
    "puntajeTotal"         DOUBLE PRECISION,
    "evaluacion"           VARCHAR(50),
    "factorReduccion"      DOUBLE PRECISION,
    "responsable"          TEXT,
    "fechaCreacion"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor"            INTEGER,
    "actualizadoPor"       INTEGER,
    CONSTRAINT "MedidaAdministracion_causaRiesgoId_fkey"
        FOREIGN KEY ("causaRiesgoId")
        REFERENCES "CausaRiesgo"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedidaAdministracion_creadoPor_fkey"
        FOREIGN KEY ("creadoPor")
        REFERENCES "Usuario"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MedidaAdministracion_actualizadoPor_fkey"
        FOREIGN KEY ("actualizadoPor")
        REFERENCES "Usuario"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS "MedidaAdministracion_causaRiesgoId_idx"
    ON "MedidaAdministracion"("causaRiesgoId");

CREATE INDEX IF NOT EXISTS "MedidaAdministracion_creadoPor_idx"
    ON "MedidaAdministracion"("creadoPor");

CREATE INDEX IF NOT EXISTS "MedidaAdministracion_actualizadoPor_idx"
    ON "MedidaAdministracion"("actualizadoPor");

-- Función para actualizar fechaActualizacion automáticamente
CREATE OR REPLACE FUNCTION update_medida_administracion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."fechaActualizacion" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar fechaActualizacion en cada UPDATE
DROP TRIGGER IF EXISTS medida_administracion_updated_at ON "MedidaAdministracion";
CREATE TRIGGER medida_administracion_updated_at
    BEFORE UPDATE ON "MedidaAdministracion"
    FOR EACH ROW
    EXECUTE FUNCTION update_medida_administracion_updated_at();
