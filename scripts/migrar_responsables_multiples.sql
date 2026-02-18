-- ============================================
-- Script de Migración: Múltiples Responsables por Proceso
-- ============================================
-- Este script migra los datos existentes de responsableId a la nueva tabla ProcesoResponsable
-- SIN BORRAR NINGÚN DATO
-- ============================================

-- Paso 1: Crear la tabla ProcesoResponsable si no existe
CREATE TABLE IF NOT EXISTS "ProcesoResponsable" (
    id SERIAL PRIMARY KEY,
    "procesoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcesoResponsable_procesoId_fkey" FOREIGN KEY ("procesoId") REFERENCES "Proceso"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcesoResponsable_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcesoResponsable_procesoId_usuarioId_key" UNIQUE ("procesoId", "usuarioId")
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS "ProcesoResponsable_procesoId_idx" ON "ProcesoResponsable"("procesoId");
CREATE INDEX IF NOT EXISTS "ProcesoResponsable_usuarioId_idx" ON "ProcesoResponsable"("usuarioId");

-- Paso 2: Migrar datos existentes de responsableId a ProcesoResponsable
-- Solo migrar procesos que tienen un responsableId y que no estén ya en la tabla
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "createdAt")
SELECT 
    p.id AS "procesoId",
    p."responsableId" AS "usuarioId",
    p."createdAt" AS "createdAt"
FROM "Proceso" p
WHERE p."responsableId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = p.id 
      AND pr."usuarioId" = p."responsableId"
  )
ON CONFLICT ("procesoId", "usuarioId") DO NOTHING;

-- Paso 3: Verificar la migración
-- Mostrar cuántos procesos tienen responsableId
SELECT 
    COUNT(*) AS "procesos_con_responsableId",
    COUNT(DISTINCT "responsableId") AS "responsables_unicos"
FROM "Proceso"
WHERE "responsableId" IS NOT NULL;

-- Mostrar cuántos registros se crearon en ProcesoResponsable
SELECT 
    COUNT(*) AS "total_responsables_migrados",
    COUNT(DISTINCT "procesoId") AS "procesos_con_responsables",
    COUNT(DISTINCT "usuarioId") AS "usuarios_responsables"
FROM "ProcesoResponsable";

-- Mostrar algunos ejemplos de la migración
SELECT 
    p.id AS "proceso_id",
    p.nombre AS "proceso_nombre",
    p."responsableId" AS "responsableId_original",
    u.nombre AS "responsable_nombre",
    pr.id AS "proceso_responsable_id"
FROM "Proceso" p
LEFT JOIN "Usuario" u ON u.id = p."responsableId"
LEFT JOIN "ProcesoResponsable" pr ON pr."procesoId" = p.id AND pr."usuarioId" = p."responsableId"
WHERE p."responsableId" IS NOT NULL
LIMIT 10;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Migracion completada exitosamente. Los datos originales se mantienen intactos.';
    RAISE NOTICE 'El campo responsableId se mantiene por compatibilidad.';
    RAISE NOTICE 'La nueva tabla ProcesoResponsable permite multiples responsables por proceso.';
END $$;

