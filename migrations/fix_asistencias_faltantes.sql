-- Script para crear asistencias faltantes para reuniones existentes

-- Primero, ver qué reuniones no tienen asistencias
SELECT 
    r.id as reunion_id,
    r."procesoId",
    r.descripcion,
    r.fecha,
    (SELECT COUNT(*) FROM "AsistenciaReunion" WHERE "reunionId" = r.id) as num_asistencias,
    (SELECT COUNT(*) FROM "AsistentesProceso" WHERE "procesoId" = r."procesoId") as num_asistentes_proceso
FROM "ReunionProceso" r
WHERE (SELECT COUNT(*) FROM "AsistenciaReunion" WHERE "reunionId" = r.id) = 0;

-- Si hay reuniones sin asistencias, crear los registros
-- NOTA: Ejecuta esto solo si la consulta anterior muestra reuniones sin asistencias

-- Para la reunión ID 1 del proceso 24 (si existe y no tiene asistencias):
INSERT INTO "AsistenciaReunion" ("reunionId", "usuarioId", "asistio", "createdAt", "updatedAt")
SELECT 
    1 as "reunionId",
    ap."usuarioId",
    false as "asistio",
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "AsistentesProceso" ap
WHERE ap."procesoId" = 24
AND NOT EXISTS (
    SELECT 1 FROM "AsistenciaReunion" ar 
    WHERE ar."reunionId" = 1 AND ar."usuarioId" = ap."usuarioId"
);

-- Verificar que se crearon
SELECT 
    ar.id,
    ar."reunionId",
    ar."usuarioId",
    u.nombre,
    ar.asistio
FROM "AsistenciaReunion" ar
JOIN "Usuario" u ON u.id = ar."usuarioId"
WHERE ar."reunionId" = 1;
