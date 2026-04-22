-- Permite almacenar 3.99 (caso especial Anexo 6 / Excel) en residual estratégico.
ALTER TABLE "EvaluacionRiesgo" ALTER COLUMN "riesgoResidual" TYPE DOUBLE PRECISION USING "riesgoResidual"::DOUBLE PRECISION;
