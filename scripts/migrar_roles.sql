-- Script de migración para crear la tabla Role y migrar datos de usuarios
-- IMPORTANTE: Ejecutar DESPUÉS de aplicar la migración de Prisma
-- 
-- PASOS:
-- 1. Ejecutar: cd gestion_riesgos_backend
-- 2. Ejecutar: npx prisma migrate dev --name add_roles_table
-- 3. Luego ejecutar este script SQL
--
-- Si obtienes el error "relation Role does not exist", primero ejecuta la migración de Prisma

-- Verificar que la tabla Role existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Role') THEN
        RAISE EXCEPTION 'La tabla Role no existe. Por favor, ejecuta primero: npx prisma migrate dev --name add_roles_table';
    END IF;
END $$;

-- 1. Crear los 4 roles base (solo si no existen)
INSERT INTO "Role" (codigo, nombre, descripcion, "permisos", activo, "createdAt", "updatedAt")
SELECT 
    'admin'::text,
    'Administrador'::text,
    'Rol con acceso completo al sistema'::text,
    '{"editar": true, "visualizar": true}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE codigo = 'admin');

INSERT INTO "Role" (codigo, nombre, descripcion, "permisos", activo, "createdAt", "updatedAt")
SELECT 
    'dueño_procesos'::text,
    'Dueño del Proceso'::text,
    'Rol para dueños de procesos que gestionan sus procesos asignados'::text,
    '{"editar": true, "visualizar": true}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE codigo = 'dueño_procesos');

INSERT INTO "Role" (codigo, nombre, descripcion, "permisos", activo, "createdAt", "updatedAt")
SELECT 
    'gerente'::text,
    'Gerente'::text,
    'Rol de gerente que puede actuar como dueño o supervisor según selección'::text,
    '{"editar": true, "visualizar": true}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE codigo = 'gerente');

INSERT INTO "Role" (codigo, nombre, descripcion, "permisos", activo, "createdAt", "updatedAt")
SELECT 
    'supervisor'::text,
    'Supervisor de Riesgos'::text,
    'Rol para supervisores que gestionan riesgos y controles'::text,
    '{"editar": true, "visualizar": true}'::jsonb,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE codigo = 'supervisor');

-- 2. Migrar usuarios existentes: mapear roles antiguos a nuevos
-- admin -> admin
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'admin')
WHERE role = 'admin' AND "roleId" IS NULL;

-- dueño_procesos -> dueño_procesos
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'dueño_procesos')
WHERE role = 'dueño_procesos' AND "roleId" IS NULL;

-- supervisor -> supervisor
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
WHERE role = 'supervisor' AND "roleId" IS NULL;

-- gerente_general, manager -> gerente
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'gerente')
WHERE role IN ('gerente_general', 'manager') AND "roleId" IS NULL;

-- director_procesos -> supervisor (ya que tiene funciones similares)
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
WHERE role = 'director_procesos' AND "roleId" IS NULL;

-- analyst -> supervisor (por defecto)
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
WHERE role = 'analyst' AND "roleId" IS NULL;

-- Si algún usuario no tiene roleId asignado, asignar supervisor por defecto
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
WHERE "roleId" IS NULL;

-- 3. Verificar que todos los usuarios tengan un roleId
SELECT 
    COUNT(*) as usuarios_sin_rol
FROM "Usuario"
WHERE "roleId" IS NULL;

