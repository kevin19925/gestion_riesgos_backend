-- AlterTable: añadir porcentaje reducción dimensión cruzada (Excel 34%). Administrable desde Configuración Residual.
ALTER TABLE "ConfiguracionResidual" ADD COLUMN IF NOT EXISTS "porcentajeReduccionDimensionCruzada" DOUBLE PRECISION;

COMMENT ON COLUMN "ConfiguracionResidual"."porcentajeReduccionDimensionCruzada" IS 'Porcentaje (0-1) de reducción cuando el control aplica a la otra dimensión (ej. 0.34). Null = usar 0.34 por defecto.';
