-- ============================================================================
-- MIGRACIÓN DE NORMALIZACIÓN COMPLETA
-- ============================================================================
-- Este script debe ejecutarse DESPUÉS de que los datos hayan sido migrados
-- desde los campos JSONB y de texto a las nuevas tablas normalizadas.
--
-- IMPORTANTE: Ejecutar solo después de verificar que todos los datos
-- fueron migrados correctamente a las nuevas estructuras.
-- ============================================================================

BEGIN;

-- 1. Crear tabla TipologiaRiesgoExtendida
CREATE TABLE IF NOT EXISTS "TipologiaRiesgoExtendida" (
    "id" SERIAL PRIMARY KEY,
    "subtipoId" INTEGER REFERENCES "SubtipoRiesgo"("id") ON DELETE SET NULL,
    "nivel" INTEGER NOT NULL CHECK ("nivel" IN (3, 4)),
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("nivel", "nombre")
);

CREATE INDEX IF NOT EXISTS "TipologiaRiesgoExtendida_subtipoId_idx" ON "TipologiaRiesgoExtendida"("subtipoId");

-- 2. Crear tabla HistorialEstadoPlan
CREATE TABLE IF NOT EXISTS "HistorialEstadoPlan" (
    "id" SERIAL PRIMARY KEY,
    "causaRiesgoId" INTEGER NOT NULL REFERENCES "CausaRiesgo"("id") ON DELETE CASCADE,
    "estado" VARCHAR(50) NOT NULL,
    "responsable" VARCHAR(255),
    "detalle" TEXT,
    "decision" TEXT,
    "porcentajeAvance" INTEGER,
    "fechaEstado" TIMESTAMP(3),
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origenMigracion" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS "HistorialEstadoPlan_causaRiesgoId_idx" ON "HistorialEstadoPlan"("causaRiesgoId");
CREATE INDEX IF NOT EXISTS "HistorialEstadoPlan_fechaEstado_idx" ON "HistorialEstadoPlan"("fechaEstado");

-- 3. Agregar nuevas columnas a ControlRiesgo
ALTER TABLE "ControlRiesgo" 
    ADD COLUMN IF NOT EXISTS "descripcionControl" TEXT,
    ADD COLUMN IF NOT EXISTS "recomendacion" TEXT,
    ADD COLUMN IF NOT EXISTS "tipoMitigacion" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "estadoAmbos" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "recalculadoEn" TIMESTAMP(3);

-- 4. Agregar nuevas columnas a PlanAccion
ALTER TABLE "PlanAccion"
    ADD COLUMN IF NOT EXISTS "tipoGestion" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "origenMigracion" BOOLEAN NOT NULL DEFAULT false;

-- 5. Agregar nuevas columnas a Riesgo para tipologías extendidas
ALTER TABLE "Riesgo"
    ADD COLUMN IF NOT EXISTS "tipologiaTipo3Id" INTEGER REFERENCES "TipologiaRiesgoExtendida"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "tipologiaTipo4Id" INTEGER REFERENCES "TipologiaRiesgoExtendida"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Riesgo_tipologiaTipo3Id_idx" ON "Riesgo"("tipologiaTipo3Id");
CREATE INDEX IF NOT EXISTS "Riesgo_tipologiaTipo4Id_idx" ON "Riesgo"("tipologiaTipo4Id");

-- 6. Agregar nueva columna gerenciaId a Proceso
ALTER TABLE "Proceso"
    ADD COLUMN IF NOT EXISTS "gerenciaId" INTEGER REFERENCES "Gerencia"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Proceso_gerenciaId_idx" ON "Proceso"("gerenciaId");

-- 7. ELIMINAR columnas obsoletas (SOLO DESPUÉS DE MIGRAR DATOS)
-- Descomentar estas líneas SOLO después de verificar que la migración fue exitosa

-- ALTER TABLE "CausaRiesgo" DROP COLUMN IF EXISTS "tipoGestion";
-- ALTER TABLE "CausaRiesgo" DROP COLUMN IF EXISTS "gestion";
-- DROP INDEX IF EXISTS "CausaRiesgo_tipoGestion_idx";

-- ALTER TABLE "Riesgo" DROP COLUMN IF EXISTS "tipologiaTipo3";
-- ALTER TABLE "Riesgo" DROP COLUMN IF EXISTS "tipologiaTipo4";

-- ALTER TABLE "Proceso" DROP COLUMN IF EXISTS "gerencia";

-- ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "role";

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Ejecutar estas queries para verificar que todo está correcto:

-- SELECT COUNT(*) as causas_con_gestion FROM "CausaRiesgo" WHERE "gestion" IS NOT NULL;
-- SELECT COUNT(*) as planes_migrados FROM "PlanAccion" WHERE "origenMigracion" = true;
-- SELECT COUNT(*) as historial_migrado FROM "HistorialEstadoPlan" WHERE "origenMigracion" = true;
-- SELECT COUNT(*) as riesgos_con_tipo3_texto FROM "Riesgo" WHERE "tipologiaTipo3" IS NOT NULL;
-- SELECT COUNT(*) as riesgos_con_tipo3_id FROM "Riesgo" WHERE "tipologiaTipo3Id" IS NOT NULL;
