-- Migración simplificada para ejecutar desde Node.js
-- Sin bloques DO $$ para evitar problemas de sintaxis

-- 1. Duplicar registros para modo "director"
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT 
    "procesoId", 
    "usuarioId", 
    'director', 
    "createdAt"
FROM "ProcesoResponsable"
WHERE modo = 'ambos' OR modo IS NULL
ON CONFLICT DO NOTHING;

-- 2. Duplicar registros para modo "proceso"
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo", "createdAt")
SELECT 
    "procesoId", 
    "usuarioId", 
    'proceso', 
    "createdAt"
FROM "ProcesoResponsable"
WHERE modo = 'ambos' OR modo IS NULL
ON CONFLICT DO NOTHING;

-- 3. Eliminar registros antiguos
DELETE FROM "ProcesoResponsable" 
WHERE modo = 'ambos' OR modo IS NULL;

-- 4. Eliminar constraint antiguo
ALTER TABLE "ProcesoResponsable" 
DROP CONSTRAINT IF EXISTS "ProcesoResponsable_procesoId_usuarioId_key";

-- 5. Agregar nuevo constraint
ALTER TABLE "ProcesoResponsable" 
ADD CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_modo_key" 
UNIQUE ("procesoId", "usuarioId", "modo");

-- 6. Hacer campo modo obligatorio
ALTER TABLE "ProcesoResponsable" 
ALTER COLUMN "modo" SET NOT NULL;
