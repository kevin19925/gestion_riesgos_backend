-- Añade la columna ambito a la tabla Role (SISTEMA = admin/config; OPERATIVO = riesgos, controles, planes).
-- Ejecutar una sola vez en la base de datos (por ejemplo desde psql o tu cliente SQL).

-- Añadir columna si no existe (PostgreSQL 9.5+)
ALTER TABLE "Role"
ADD COLUMN IF NOT EXISTS ambito VARCHAR(20) NOT NULL DEFAULT 'OPERATIVO';

-- Comentario en la columna (opcional)
COMMENT ON COLUMN "Role".ambito IS 'SISTEMA = administración y configuración; OPERATIVO = sistema de riesgos, controles, planes';

-- Opcional: actualizar el rol admin existente a ámbito SISTEMA para que siga entrando a administración
-- Descomenta y ajusta el código del rol si tu rol admin tiene otro codigo:
-- UPDATE "Role" SET ambito = 'SISTEMA' WHERE codigo = 'admin';
