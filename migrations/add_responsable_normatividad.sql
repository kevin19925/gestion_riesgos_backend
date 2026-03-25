-- Agregar campo responsable a la tabla Normatividad
-- Este campo almacena el responsable cuando el cumplimiento es "Parcial"

-- Agregar la columna responsable
ALTER TABLE "Normatividad" 
ADD COLUMN IF NOT EXISTS "responsable" TEXT;

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Normatividad'
AND column_name = 'responsable';
