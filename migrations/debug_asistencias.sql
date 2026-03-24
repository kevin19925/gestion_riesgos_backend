-- Script para diagnosticar el problema de asistencias

-- 1. Ver asistentes del proceso 24
SELECT 
    ap.id,
    ap."procesoId",
    ap."usuarioId",
    ap.rol,
    u.nombre as usuario_nombre,
    u.email
FROM "AsistentesProceso" ap
JOIN "Usuario" u ON u.id = ap."usuarioId"
WHERE ap."procesoId" = 24;

-- 2. Ver reuniones del proceso 24
SELECT 
    r.id,
    r."procesoId",
    r.fecha,
    r.descripcion,
    r.estado,
    r."createdAt"
FROM "ReunionProceso" r
WHERE r."procesoId" = 24
ORDER BY r.fecha DESC;

-- 3. Ver asistencias de todas las reuniones del proceso 24
SELECT 
    ar.id,
    ar."reunionId",
    ar."usuarioId",
    ar.asistio,
    ar."registradoEn",
    u.nombre as usuario_nombre,
    r.descripcion as reunion_descripcion,
    r.fecha as reunion_fecha
FROM "AsistenciaReunion" ar
JOIN "Usuario" u ON u.id = ar."usuarioId"
JOIN "ReunionProceso" r ON r.id = ar."reunionId"
WHERE r."procesoId" = 24
ORDER BY ar."reunionId", u.nombre;

-- 4. Contar asistencias por reunión
SELECT 
    r.id as reunion_id,
    r.descripcion,
    r.fecha,
    COUNT(ar.id) as cantidad_asistencias
FROM "ReunionProceso" r
LEFT JOIN "AsistenciaReunion" ar ON ar."reunionId" = r.id
WHERE r."procesoId" = 24
GROUP BY r.id, r.descripcion, r.fecha
ORDER BY r.fecha DESC;
