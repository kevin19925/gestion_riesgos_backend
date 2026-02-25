-- CreateTable: MapaConfig (requerida por FK en CalificacionInherenteConfig)
CREATE TABLE IF NOT EXISTS "MapaConfig" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "ejes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CalificacionInherenteConfig
CREATE TABLE IF NOT EXISTS "CalificacionInherenteConfig" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Configuración Principal',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "mapaConfigId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalificacionInherenteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FormulaCalificacionInherente
CREATE TABLE IF NOT EXISTS "FormulaCalificacionInherente" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "tipoOperacion" TEXT NOT NULL DEFAULT 'multiplicacion',
    "campos" JSONB NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaCalificacionInherente_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExcepcionCalificacion
CREATE TABLE IF NOT EXISTS "ExcepcionCalificacion" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "condiciones" JSONB NOT NULL,
    "resultado" DOUBLE PRECISION NOT NULL,
    "prioridad" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcepcionCalificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RangoCalificacion
CREATE TABLE IF NOT EXISTS "RangoCalificacion" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RangoCalificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReglaAgregacionCalificacion
CREATE TABLE IF NOT EXISTS "ReglaAgregacionCalificacion" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "tipoAgregacion" TEXT NOT NULL DEFAULT 'maximo',
    "tablaOrigen" TEXT NOT NULL,
    "campoOrigen" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglaAgregacionCalificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CalificacionInherenteConfig_nombre_key" ON "CalificacionInherenteConfig"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CalificacionInherenteConfig_mapaConfigId_key" ON "CalificacionInherenteConfig"("mapaConfigId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FormulaCalificacionInherente_configId_key" ON "FormulaCalificacionInherente"("configId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExcepcionCalificacion_configId_idx" ON "ExcepcionCalificacion"("configId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RangoCalificacion_configId_idx" ON "RangoCalificacion"("configId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RangoCalificacion_configId_orden_idx" ON "RangoCalificacion"("configId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReglaAgregacionCalificacion_configId_key" ON "ReglaAgregacionCalificacion"("configId");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CalificacionInherenteConfig_mapaConfigId_fkey'
    ) THEN
        ALTER TABLE "CalificacionInherenteConfig" 
        ADD CONSTRAINT "CalificacionInherenteConfig_mapaConfigId_fkey" 
        FOREIGN KEY ("mapaConfigId") 
        REFERENCES "MapaConfig"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'FormulaCalificacionInherente_configId_fkey'
    ) THEN
        ALTER TABLE "FormulaCalificacionInherente" 
        ADD CONSTRAINT "FormulaCalificacionInherente_configId_fkey" 
        FOREIGN KEY ("configId") 
        REFERENCES "CalificacionInherenteConfig"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ExcepcionCalificacion_configId_fkey'
    ) THEN
        ALTER TABLE "ExcepcionCalificacion" 
        ADD CONSTRAINT "ExcepcionCalificacion_configId_fkey" 
        FOREIGN KEY ("configId") 
        REFERENCES "CalificacionInherenteConfig"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'RangoCalificacion_configId_fkey'
    ) THEN
        ALTER TABLE "RangoCalificacion" 
        ADD CONSTRAINT "RangoCalificacion_configId_fkey" 
        FOREIGN KEY ("configId") 
        REFERENCES "CalificacionInherenteConfig"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ReglaAgregacionCalificacion_configId_fkey'
    ) THEN
        ALTER TABLE "ReglaAgregacionCalificacion" 
        ADD CONSTRAINT "ReglaAgregacionCalificacion_configId_fkey" 
        FOREIGN KEY ("configId") 
        REFERENCES "CalificacionInherenteConfig"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

