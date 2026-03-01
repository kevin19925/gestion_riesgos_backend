-- Añade la columna fotoPerfil a Usuario si no existe (URL de la foto en Azure).
-- Ejecutar manualmente si la tabla fue creada antes de tener este campo.

ALTER TABLE "Usuario"
ADD COLUMN IF NOT EXISTS "fotoPerfil" TEXT;

COMMENT ON COLUMN "Usuario"."fotoPerfil" IS 'URL de la foto de perfil en Azure Blob';
