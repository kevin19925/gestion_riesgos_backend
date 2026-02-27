-- Script para crear tablas de Configuración Residual
-- Ejecutar manualmente en la base de datos

-- Tabla principal de configuración
CREATE TABLE IF NOT EXISTS "ConfiguracionResidual" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionResidual_pkey" PRIMARY KEY ("id")
);

-- Índice único en nombre
CREATE UNIQUE INDEX IF NOT EXISTS "ConfiguracionResidual_nombre_key" ON "ConfiguracionResidual"("nombre");

-- Tabla de pesos de criterios
CREATE TABLE IF NOT EXISTS "PesoCriterioResidual" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "criterio" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesoCriterioResidual_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "PesoCriterioResidual" ADD CONSTRAINT "PesoCriterioResidual_configId_fkey" 
    FOREIGN KEY ("configId") REFERENCES "ConfiguracionResidual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla de rangos de evaluación preliminar
CREATE TABLE IF NOT EXISTS "RangoEvaluacionResidual" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "nivelNombre" TEXT NOT NULL,
    "valorMinimo" DOUBLE PRECISION NOT NULL,
    "valorMaximo" DOUBLE PRECISION NOT NULL,
    "incluirMinimo" BOOLEAN NOT NULL DEFAULT true,
    "incluirMaximo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RangoEvaluacionResidual_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "RangoEvaluacionResidual" ADD CONSTRAINT "RangoEvaluacionResidual_configId_fkey" 
    FOREIGN KEY ("configId") REFERENCES "ConfiguracionResidual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla de mitigación
CREATE TABLE IF NOT EXISTS "TablaMitigacionResidual" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "evaluacion" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TablaMitigacionResidual_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "TablaMitigacionResidual" ADD CONSTRAINT "TablaMitigacionResidual_configId_fkey" 
    FOREIGN KEY ("configId") REFERENCES "ConfiguracionResidual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla de opciones de criterios
CREATE TABLE IF NOT EXISTS "OpcionCriterioResidual" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "criterio" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpcionCriterioResidual_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "OpcionCriterioResidual" ADD CONSTRAINT "OpcionCriterioResidual_configId_fkey" 
    FOREIGN KEY ("configId") REFERENCES "ConfiguracionResidual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla de rangos de nivel de riesgo residual
CREATE TABLE IF NOT EXISTS "RangoNivelRiesgoResidual" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "nivelNombre" TEXT NOT NULL,
    "valorMinimo" DOUBLE PRECISION NOT NULL,
    "valorMaximo" DOUBLE PRECISION NOT NULL,
    "incluirMinimo" BOOLEAN NOT NULL DEFAULT true,
    "incluirMaximo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RangoNivelRiesgoResidual_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "RangoNivelRiesgoResidual" ADD CONSTRAINT "RangoNivelRiesgoResidual_configId_fkey" 
    FOREIGN KEY ("configId") REFERENCES "ConfiguracionResidual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mensaje de confirmación
SELECT 'Tablas de Configuración Residual creadas exitosamente' AS resultado;
