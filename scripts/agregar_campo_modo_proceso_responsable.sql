-- Script para agregar el campo 'modo' a la tabla ProcesoResponsable
-- Este campo permite especificar si un gerente actúa como 'dueño' o 'supervisor' para cada proceso

-- 1. Agregar la columna 'modo' si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ProcesoResponsable' 
        AND column_name = 'modo'
    ) THEN
        ALTER TABLE "ProcesoResponsable" 
        ADD COLUMN "modo" VARCHAR(20);
        
        RAISE NOTICE 'Columna "modo" agregada a la tabla ProcesoResponsable';
    ELSE
        RAISE NOTICE 'La columna "modo" ya existe en la tabla ProcesoResponsable';
    END IF;
END $$;

-- 2. Crear un índice para mejorar las consultas por modo (opcional)
CREATE INDEX IF NOT EXISTS "ProcesoResponsable_modo_idx" ON "ProcesoResponsable"("modo");

-- 3. Comentario en la columna
COMMENT ON COLUMN "ProcesoResponsable"."modo" IS 'Modo del gerente para este proceso: "dueño" o "supervisor". Solo aplica para usuarios con rol "gerente".';

-- Verificar que la columna se creó correctamente
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ProcesoResponsable' 
AND column_name = 'modo';

