-- ============================================
-- SCRIPT PARA SINCRONIZAR RESPONSABLES
-- ============================================
-- Este script crea registros en ProcesoResponsable para todos
-- los procesos que tienen responsableId pero no están sincronizados
-- ============================================

-- PASO 1: Ver qué se va a crear (PREVIEW)
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId" as usuario_id,
  u.nombre as usuario_nombre,
  'proceso' as modo,
  'SE CREARÁ' as accion
FROM "Proceso" p
JOIN "Usuario" u ON p."responsableId" = u.id
WHERE p."responsableId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = p.id 
      AND pr."usuarioId" = p."responsableId" 
      AND pr.modo = 'proceso'
  )
ORDER BY p.id;

-- ============================================
-- PASO 2: EJECUTAR LA SINCRONIZACIÓN
-- ============================================
-- ⚠️ IMPORTANTE: Revisa el PASO 1 antes de ejecutar esto
-- ============================================

INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", modo, "createdAt")
SELECT 
  p.id as "procesoId",
  p."responsableId" as "usuarioId",
  'proceso' as modo,
  NOW() as "createdAt"
FROM "Proceso" p
WHERE p."responsableId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = p.id 
      AND pr."usuarioId" = p."responsableId" 
      AND pr.modo = 'proceso'
  );

-- ============================================
-- PASO 3: VERIFICAR QUE SE CREARON
-- ============================================

SELECT 
  'Después de sincronizar:' as estado,
  COUNT(*) as cantidad
FROM "Proceso" p
WHERE p."responsableId" IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = p.id 
      AND pr."usuarioId" = p."responsableId" 
      AND pr.modo = 'proceso'
  );

-- ============================================
-- PASO 4: VER TODOS LOS PROCESOS SINCRONIZADOS
-- ============================================

SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId",
  u.nombre as responsable_nombre,
  pr.id as registro_id,
  pr.modo,
  '✅ SINCRONIZADO' as estado
FROM "Proceso" p
JOIN "Usuario" u ON p."responsableId" = u.id
JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId" 
  AND pr."usuarioId" = p."responsableId" 
  AND pr.modo = 'proceso'
WHERE p."responsableId" IS NOT NULL
ORDER BY p.id;
