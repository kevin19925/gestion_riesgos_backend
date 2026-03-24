-- Verificar si existe la reunión ID 1 y sus asistencias

SELECT 
    r.id,
    r."procesoId",
    r.fecha,
    r.descripcion,
    r.estado
FROM "ReunionProceso" r
WHERE r.id = 1;

-- Ver asistencias de la reunión 1
SELECT 
    ar.id,
    ar."reunionId",
    ar."usuarioId",
    ar.asistio,
    u.nombre
FROM "AsistenciaReunion" ar
JOIN "Usuario" u ON u.id = ar."usuarioId"
WHERE ar."reunionId" = 1;

-- Ver todas las reuniones del proceso 24
SELECT 
    r.id,
    r."procesoId",
    r.fecha,
    r.descripcion,
    r.estado,
    (SELECT COUNT(*) FROM "AsistenciaReunion" WHERE "reunionId" = r.id) as num_asistencias
FROM "ReunionProceso" r
WHERE r."procesoId" = 24
ORDER BY r.id;
