-- Residual estrategico (CWR): modo por proceso + campos MA en ControlRiesgo
ALTER TABLE "Proceso" ADD COLUMN "residualModo" VARCHAR(20) NOT NULL DEFAULT 'ESTANDAR';

ALTER TABLE "ControlRiesgo" ADD COLUMN "tipoMitigacionAnexo" VARCHAR(20);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maPresupuesto" VARCHAR(20);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maActitud" VARCHAR(20);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maCapacitacion" VARCHAR(20);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maDocumentacion" VARCHAR(20);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maMonitoreo" VARCHAR(20);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maPuntajeAy" DOUBLE PRECISION;
ALTER TABLE "ControlRiesgo" ADD COLUMN "maEvaluacionAz" VARCHAR(64);
ALTER TABLE "ControlRiesgo" ADD COLUMN "maPorcentajeBa" DOUBLE PRECISION;
