-- Script completo para crear la tabla Role y migrar datos
-- Este script crea la tabla si no existe y luego migra los datos
-- Útil cuando hay problemas con las migraciones de Prisma

-- ============================================
-- PASO 1: Crear la tabla Role si no existe
-- ============================================
CREATE TABLE IF NOT EXISTS "Role" (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    permisos JSONB,
    activo BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PASO 2: Agregar columna roleId a Usuario si no existe
-- ============================================
DO $$
BEGIN
    -- Verificar si la columna roleId existe, si no, crearla
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Usuario' AND column_name = 'roleId'
    ) THEN
        -- Agregar columna roleId (temporalmente nullable para migración)
        ALTER TABLE "Usuario" ADD COLUMN "roleId" INTEGER;
        
        -- Agregar foreign key constraint después de migrar datos
        -- (se agregará al final del script)
    END IF;
END $$;

-- ============================================
-- PASO 3: Crear los 4 roles base
-- ============================================
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

-- ============================================
-- PASO 4: Migrar usuarios existentes
-- ============================================
-- Solo migrar si la columna 'role' todavía existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Usuario' AND column_name = 'role'
    ) THEN
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

        -- director_procesos -> supervisor
        UPDATE "Usuario" 
        SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
        WHERE role = 'director_procesos' AND "roleId" IS NULL;

        -- analyst -> supervisor (por defecto)
        UPDATE "Usuario" 
        SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
        WHERE role = 'analyst' AND "roleId" IS NULL;
    END IF;
END $$;

-- Si algún usuario no tiene roleId asignado, asignar supervisor por defecto
UPDATE "Usuario" 
SET "roleId" = (SELECT id FROM "Role" WHERE codigo = 'supervisor')
WHERE "roleId" IS NULL;

-- ============================================
-- PASO 5: Hacer roleId NOT NULL y agregar foreign key
-- ============================================
DO $$
BEGIN
    -- Hacer roleId NOT NULL
    ALTER TABLE "Usuario" ALTER COLUMN "roleId" SET NOT NULL;
    
    -- Agregar foreign key constraint si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Usuario_roleId_fkey' 
        AND table_name = 'Usuario'
    ) THEN
        ALTER TABLE "Usuario" 
        ADD CONSTRAINT "Usuario_roleId_fkey" 
        FOREIGN KEY ("roleId") REFERENCES "Role"(id);
    END IF;
END $$;

-- ============================================
-- PASO 6: Verificar migración
-- ============================================
SELECT 
    'Roles creados:' as info,
    COUNT(*) as total
FROM "Role";

SELECT 
    'Usuarios con rol asignado:' as info,
    COUNT(*) as total
FROM "Usuario"
WHERE "roleId" IS NOT NULL;

SELECT 
    'Usuarios sin rol (debería ser 0):' as info,
    COUNT(*) as total
FROM "Usuario"
WHERE "roleId" IS NULL;

-- Mostrar resumen de usuarios y sus roles
SELECT 
    u.id,
    u.nombre,
    u.email,
    r.codigo as rol_codigo,
    r.nombre as rol_nombre
FROM "Usuario" u
LEFT JOIN "Role" r ON u."roleId" = r.id
ORDER BY u.id;

