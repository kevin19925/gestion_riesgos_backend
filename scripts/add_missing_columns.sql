-- Script para agregar columnas faltantes en la base de datos
-- Ejecutar este script en pgAdmin conectado a la base de datos riesgos_db_cv8c

-- ============================================
-- TABLA: Riesgo
-- ============================================

-- Agregar zona si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Riesgo' 
        AND column_name = 'zona'
    ) THEN
        ALTER TABLE "Riesgo" ADD COLUMN "zona" TEXT;
    END IF;
END $$;

-- Agregar numeroIdentificacion si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Riesgo' 
        AND column_name = 'numeroIdentificacion'
    ) THEN
        ALTER TABLE "Riesgo" ADD COLUMN "numeroIdentificacion" TEXT;
    END IF;
END $$;

-- Agregar tipologiaNivelI si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Riesgo' 
        AND column_name = 'tipologiaNivelI'
    ) THEN
        ALTER TABLE "Riesgo" ADD COLUMN "tipologiaNivelI" TEXT;
    END IF;
END $$;

-- Agregar tipologiaNivelII si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Riesgo' 
        AND column_name = 'tipologiaNivelII'
    ) THEN
        ALTER TABLE "Riesgo" ADD COLUMN "tipologiaNivelII" TEXT;
    END IF;
END $$;

-- ============================================
-- TABLA: CausaRiesgo
-- ============================================

-- Cambiar frecuencia de INT a TEXT si es necesario
DO $$ 
BEGIN
    -- Verificar si frecuencia existe y es INT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'CausaRiesgo' 
        AND column_name = 'frecuencia'
        AND data_type = 'integer'
    ) THEN
        -- Cambiar el tipo de INT a TEXT
        ALTER TABLE "CausaRiesgo" ALTER COLUMN "frecuencia" TYPE TEXT USING frecuencia::TEXT;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'CausaRiesgo' 
        AND column_name = 'frecuencia'
    ) THEN
        -- Si no existe, agregarla como TEXT
        ALTER TABLE "CausaRiesgo" ADD COLUMN "frecuencia" TEXT;
    END IF;
END $$;

-- ============================================
-- TABLA: EvaluacionRiesgo
-- ============================================

-- Agregar riesgoInherente si no existe (MUY IMPORTANTE)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'EvaluacionRiesgo' 
        AND column_name = 'riesgoInherente'
    ) THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "riesgoInherente" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Agregar confidencialidadSGSI si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'EvaluacionRiesgo' 
        AND column_name = 'confidencialidadSGSI'
    ) THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "confidencialidadSGSI" INTEGER;
    END IF;
END $$;

-- Agregar disponibilidadSGSI si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'EvaluacionRiesgo' 
        AND column_name = 'disponibilidadSGSI'
    ) THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "disponibilidadSGSI" INTEGER;
    END IF;
END $$;

-- Agregar integridadSGSI si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'EvaluacionRiesgo' 
        AND column_name = 'integridadSGSI'
    ) THEN
        ALTER TABLE "EvaluacionRiesgo" ADD COLUMN "integridadSGSI" INTEGER;
    END IF;
END $$;

-- Verificar que todas las columnas se agregaron correctamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('Riesgo', 'CausaRiesgo', 'EvaluacionRiesgo')
AND column_name IN (
    'zona', 'numeroIdentificacion', 'tipologiaNivelI', 'tipologiaNivelII',
    'frecuencia',
    'riesgoInherente', 'confidencialidadSGSI', 'disponibilidadSGSI', 'integridadSGSI'
)
ORDER BY table_name, column_name;

