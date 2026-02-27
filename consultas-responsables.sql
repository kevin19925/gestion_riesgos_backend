-- ============================================
-- CONSULTAS PARA REVISAR RESPONSABLES
-- ============================================

-- 1. Ver todos los dueños de proceso (campo responsableId en tabla Proceso)
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId" as responsable_id,
  u.nombre as responsable_nombre,
  u.email as responsable_email,
  r.nombre as rol_nombre
FROM "Proceso" p
LEFT JOIN "Usuario" u ON p."responsableId" = u.id
LEFT JOIN "Role" r ON u."roleId" = r.id
WHERE p."responsableId" IS NOT NULL
ORDER BY p.id;

-- ============================================

-- 2. Ver todos los registros en ProcesoResponsable (tabla de múltiples responsables)
SELECT 
  pr.id,
  pr."procesoId",
  p.nombre as proceso_nombre,
  pr."usuarioId",
  u.nombre as usuario_nombre,
  u.email as usuario_email,
  pr.modo,
  r.nombre as rol_usuario,
  pr."createdAt"
FROM "ProcesoResponsable" pr
JOIN "Proceso" p ON pr."procesoId" = p.id
JOIN "Usuario" u ON pr."usuarioId" = u.id
LEFT JOIN "Role" r ON u."roleId" = r.id
ORDER BY pr."procesoId", pr.modo, pr."usuarioId";

-- ============================================

-- 3. Comparar: responsableId vs ProcesoResponsable con modo='proceso'
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId" as responsable_en_proceso,
  u1.nombre as nombre_en_proceso,
  pr."usuarioId" as responsable_en_tabla,
  u2.nombre as nombre_en_tabla,
  pr.modo,
  CASE 
    WHEN p."responsableId" = pr."usuarioId" AND pr.modo = 'proceso' THEN '✅ SINCRONIZADO'
    WHEN p."responsableId" IS NOT NULL AND pr."usuarioId" IS NULL THEN '❌ FALTA EN ProcesoResponsable'
    WHEN p."responsableId" != pr."usuarioId" THEN '⚠️ DIFERENTE'
    ELSE '❓ REVISAR'
  END as estado
FROM "Proceso" p
LEFT JOIN "Usuario" u1 ON p."responsableId" = u1.id
LEFT JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId" AND pr.modo = 'proceso'
LEFT JOIN "Usuario" u2 ON pr."usuarioId" = u2.id
WHERE p."responsableId" IS NOT NULL OR pr."usuarioId" IS NOT NULL
ORDER BY p.id;

-- ============================================

-- 4. Ver procesos con responsables duplicados (mismo usuario con múltiples modos)
SELECT 
  pr."procesoId",
  p.nombre as proceso_nombre,
  pr."usuarioId",
  u.nombre as usuario_nombre,
  STRING_AGG(pr.modo, ', ' ORDER BY pr.modo) as modos,
  COUNT(*) as cantidad_registros
FROM "ProcesoResponsable" pr
JOIN "Proceso" p ON pr."procesoId" = p.id
JOIN "Usuario" u ON pr."usuarioId" = u.id
GROUP BY pr."procesoId", p.nombre, pr."usuarioId", u.nombre
HAVING COUNT(*) > 1
ORDER BY pr."procesoId";

-- ============================================

-- 5. Ver procesos SIN responsables asignados
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId",
  COUNT(pr.id) as registros_en_tabla
FROM "Proceso" p
LEFT JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId"
GROUP BY p.id, p.nombre, p."responsableId"
HAVING p."responsableId" IS NULL AND COUNT(pr.id) = 0
ORDER BY p.id;

-- ============================================

-- 6. Ver usuarios que son responsables y en cuántos procesos
SELECT 
  u.id as usuario_id,
  u.nombre as usuario_nombre,
  u.email,
  r.nombre as rol,
  COUNT(DISTINCT CASE WHEN pr.modo = 'proceso' THEN pr."procesoId" END) as procesos_como_dueno,
  COUNT(DISTINCT CASE WHEN pr.modo = 'director' THEN pr."procesoId" END) as procesos_como_director,
  COUNT(DISTINCT pr."procesoId") as total_procesos
FROM "Usuario" u
LEFT JOIN "Role" r ON u."roleId" = r.id
LEFT JOIN "ProcesoResponsable" pr ON u.id = pr."usuarioId"
WHERE pr.id IS NOT NULL
GROUP BY u.id, u.nombre, u.email, r.nombre
ORDER BY total_procesos DESC;

-- ============================================

-- 7. Ver registros con modo NULL (problema común)
SELECT 
  pr.id,
  pr."procesoId",
  p.nombre as proceso_nombre,
  pr."usuarioId",
  u.nombre as usuario_nombre,
  pr.modo,
  pr."createdAt"
FROM "ProcesoResponsable" pr
JOIN "Proceso" p ON pr."procesoId" = p.id
JOIN "Usuario" u ON pr."usuarioId" = u.id
WHERE pr.modo IS NULL
ORDER BY pr."procesoId";

-- ============================================

-- 8. Ver proceso específico (cambiar el ID)
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId" as responsable_principal,
  u1.nombre as nombre_responsable_principal,
  '---' as separador,
  pr.id as registro_id,
  pr."usuarioId",
  u2.nombre as usuario_nombre,
  pr.modo,
  pr."createdAt"
FROM "Proceso" p
LEFT JOIN "Usuario" u1 ON p."responsableId" = u1.id
LEFT JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId"
LEFT JOIN "Usuario" u2 ON pr."usuarioId" = u2.id
WHERE p.id = 11  -- ⬅️ CAMBIAR ESTE NÚMERO
ORDER BY pr.modo, pr."usuarioId";

-- ============================================

-- 9. Contar registros por modo
SELECT 
  modo,
  COUNT(*) as cantidad
FROM "ProcesoResponsable"
GROUP BY modo
ORDER BY cantidad DESC;

-- ============================================

-- 10. Ver procesos con inconsistencias (responsableId diferente a ProcesoResponsable)
SELECT 
  p.id as proceso_id,
  p.nombre as proceso_nombre,
  p."responsableId" as id_en_proceso,
  u1.nombre as nombre_en_proceso,
  pr."usuarioId" as id_en_tabla,
  u2.nombre as nombre_en_tabla,
  pr.modo
FROM "Proceso" p
LEFT JOIN "Usuario" u1 ON p."responsableId" = u1.id
LEFT JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId" AND pr.modo = 'proceso'
LEFT JOIN "Usuario" u2 ON pr."usuarioId" = u2.id
WHERE p."responsableId" IS NOT NULL 
  AND (pr."usuarioId" IS NULL OR p."responsableId" != pr."usuarioId")
ORDER BY p.id;
