-- ============================================
-- DIAGNÓSTICO: Asignaciones de Dueños de Proceso
-- ============================================

-- 1. Ver qué procesos tiene asignados cada dueño de proceso
-- (Basado en el campo responsableId de la tabla Proceso)
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_nombre,
  u.email,
  r.nombre as rol,
  COUNT(p.id) as procesos_asignados,
  STRING_AGG(p.nombre, ', ' ORDER BY p.nombre) as nombres_procesos
FROM "Usuario" u
LEFT JOIN "Role" r ON u."roleId" = r.id
LEFT JOIN "Proceso" p ON u.id = p."responsableId"
WHERE r.codigo = 'DUENO_PROCESO'  -- Filtrar solo dueños de proceso
GROUP BY u.id, u.nombre, u.email, r.nombre
ORDER BY procesos_asignados DESC, u.nombre;

-- ============================================

-- 2. Ver qué procesos tiene cada dueño según ProcesoResponsable
-- (Basado en la tabla ProcesoResponsable con modo='proceso')
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_nombre,
  u.email,
  r.nombre as rol,
  COUNT(pr."procesoId") as procesos_en_tabla,
  STRING_AGG(p.nombre, ', ' ORDER BY p.nombre) as nombres_procesos
FROM "Usuario" u
LEFT JOIN "Role" r ON u."roleId" = r.id
LEFT JOIN "ProcesoResponsable" pr ON u.id = pr."usuarioId" AND pr.modo = 'proceso'
LEFT JOIN "Proceso" p ON pr."procesoId" = p.id
WHERE r.codigo = 'DUENO_PROCESO'
GROUP BY u.id, u.nombre, u.email, r.nombre
ORDER BY procesos_en_tabla DESC, u.nombre;

-- ============================================

-- 3. COMPARACIÓN: responsableId vs ProcesoResponsable
-- Ver si están sincronizados
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_nombre,
  COUNT(DISTINCT p.id) as procesos_en_responsableId,
  COUNT(DISTINCT pr."procesoId") as procesos_en_tabla,
  CASE 
    WHEN COUNT(DISTINCT p.id) = COUNT(DISTINCT pr."procesoId") THEN '✅ SINCRONIZADO'
    WHEN COUNT(DISTINCT p.id) > COUNT(DISTINCT pr."procesoId") THEN '❌ FALTAN EN ProcesoResponsable'
    WHEN COUNT(DISTINCT p.id) < COUNT(DISTINCT pr."procesoId") THEN '⚠️ SOBRAN EN ProcesoResponsable'
    ELSE '❓ REVISAR'
  END as estado
FROM "Usuario" u
LEFT JOIN "Role" r ON u."roleId" = r.id
LEFT JOIN "Proceso" p ON u.id = p."responsableId"
LEFT JOIN "ProcesoResponsable" pr ON u.id = pr."usuarioId" AND pr.modo = 'proceso'
WHERE r.codigo = 'DUENO_PROCESO'
GROUP BY u.id, u.nombre
ORDER BY u.nombre;

-- ============================================

-- 4. Ver usuario específico: Katherine Chavez
SELECT 
  'Procesos en campo responsableId:' as tipo,
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId",
  u.nombre as responsable_nombre
FROM "Proceso" p
JOIN "Usuario" u ON p."responsableId" = u.id
WHERE u.nombre LIKE '%Katherine%' OR u.nombre LIKE '%Chavez%'

UNION ALL

SELECT 
  'Procesos en ProcesoResponsable:' as tipo,
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  pr."usuarioId" as responsableId,
  u.nombre as responsable_nombre
FROM "ProcesoResponsable" pr
JOIN "Proceso" p ON pr."procesoId" = p.id
JOIN "Usuario" u ON pr."usuarioId" = u.id
WHERE (u.nombre LIKE '%Katherine%' OR u.nombre LIKE '%Chavez%')
  AND pr.modo = 'proceso'
ORDER BY tipo, proceso_id;

-- ============================================

-- 5. Ver usuario específico: Luis Terán
SELECT 
  'Procesos en campo responsableId:' as tipo,
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId",
  u.nombre as responsable_nombre
FROM "Proceso" p
JOIN "Usuario" u ON p."responsableId" = u.id
WHERE u.nombre LIKE '%Luis%' OR u.nombre LIKE '%Terán%' OR u.nombre LIKE '%Teran%'

UNION ALL

SELECT 
  'Procesos en ProcesoResponsable:' as tipo,
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  pr."usuarioId" as responsableId,
  u.nombre as responsable_nombre
FROM "ProcesoResponsable" pr
JOIN "Proceso" p ON pr."procesoId" = p.id
JOIN "Usuario" u ON pr."usuarioId" = u.id
WHERE (u.nombre LIKE '%Luis%' OR u.nombre LIKE '%Terán%' OR u.nombre LIKE '%Teran%')
  AND pr.modo = 'proceso'
ORDER BY tipo, proceso_id;

-- ============================================

-- 6. Ver TODOS los dueños de proceso y sus asignaciones
SELECT 
  u.id,
  u.nombre,
  u.email,
  r.nombre as rol,
  COALESCE(procesos_responsableId.cantidad, 0) as en_responsableId,
  COALESCE(procesos_tabla.cantidad, 0) as en_tabla,
  COALESCE(procesos_responsableId.nombres, 'NINGUNO') as procesos_responsableId,
  COALESCE(procesos_tabla.nombres, 'NINGUNO') as procesos_tabla
FROM "Usuario" u
JOIN "Role" r ON u."roleId" = r.id
LEFT JOIN (
  SELECT 
    p."responsableId" as usuario_id,
    COUNT(*) as cantidad,
    STRING_AGG(p.nombre, ', ' ORDER BY p.nombre) as nombres
  FROM "Proceso" p
  WHERE p."responsableId" IS NOT NULL
  GROUP BY p."responsableId"
) procesos_responsableId ON u.id = procesos_responsableId.usuario_id
LEFT JOIN (
  SELECT 
    pr."usuarioId" as usuario_id,
    COUNT(*) as cantidad,
    STRING_AGG(p.nombre, ', ' ORDER BY p.nombre) as nombres
  FROM "ProcesoResponsable" pr
  JOIN "Proceso" p ON pr."procesoId" = p.id
  WHERE pr.modo = 'proceso'
  GROUP BY pr."usuarioId"
) procesos_tabla ON u.id = procesos_tabla.usuario_id
WHERE r.codigo = 'DUENO_PROCESO'
ORDER BY u.nombre;

-- ============================================

-- 7. Ver procesos que tienen responsableId pero NO tienen registro en ProcesoResponsable
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId",
  u.nombre as responsable_nombre,
  '❌ FALTA SINCRONIZAR' as estado
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

-- 8. Contar totales
SELECT 
  'Total procesos con responsableId' as metrica,
  COUNT(*) as cantidad
FROM "Proceso"
WHERE "responsableId" IS NOT NULL

UNION ALL

SELECT 
  'Total registros en ProcesoResponsable con modo=proceso' as metrica,
  COUNT(*) as cantidad
FROM "ProcesoResponsable"
WHERE modo = 'proceso'

UNION ALL

SELECT 
  'Procesos sincronizados' as metrica,
  COUNT(*) as cantidad
FROM "Proceso" p
WHERE p."responsableId" IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = p.id 
      AND pr."usuarioId" = p."responsableId" 
      AND pr.modo = 'proceso'
  )

UNION ALL

SELECT 
  'Procesos SIN sincronizar' as metrica,
  COUNT(*) as cantidad
FROM "Proceso" p
WHERE p."responsableId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM "ProcesoResponsable" pr 
    WHERE pr."procesoId" = p.id 
      AND pr."usuarioId" = p."responsableId" 
      AND pr.modo = 'proceso'
  );
