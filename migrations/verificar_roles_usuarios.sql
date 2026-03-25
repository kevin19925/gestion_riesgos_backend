-- Verificar roles de usuarios en el sistema
-- Para validar que existen usuarios con roles de Supervisor y Gerente

-- 1. Ver todos los usuarios y sus roles
SELECT 
    id,
    username,
    email,
    "fullName",
    role,
    department,
    position,
    "esDuenoProcesos"
FROM "Usuario"
ORDER BY role, username;

-- 2. Contar usuarios por rol
SELECT 
    role,
    COUNT(*) as cantidad
FROM "Usuario"
GROUP BY role
ORDER BY cantidad DESC;

-- 3. Verificar usuarios con rol Supervisor
SELECT 
    id,
    username,
    email,
    "fullName",
    role,
    department
FROM "Usuario"
WHERE LOWER(role) = 'supervisor';

-- 4. Verificar usuarios con rol Gerente (incluyendo alias)
SELECT 
    id,
    username,
    email,
    "fullName",
    role,
    department
FROM "Usuario"
WHERE LOWER(role) IN ('gerente', 'gerente_general', 'manager');

-- 5. Ver planes de acción y sus estados actuales
SELECT 
    pa.id,
    pa.descripcion,
    pa.estado,
    pa.responsable,
    pa."fechaProgramada",
    cr.descripcion as causa_descripcion,
    r."numeroIdentificacion" as riesgo_numero
FROM "PlanAccion" pa
LEFT JOIN "CausaRiesgo" cr ON pa."causaRiesgoId" = cr.id
LEFT JOIN "Riesgo" r ON cr."riesgoId" = r.id
WHERE pa."causaRiesgoId" IS NOT NULL
ORDER BY pa.estado, pa.id;

-- 6. Contar planes por estado
SELECT 
    estado,
    COUNT(*) as cantidad
FROM "PlanAccion"
WHERE "causaRiesgoId" IS NOT NULL
GROUP BY estado
ORDER BY 
    CASE estado
        WHEN 'pendiente' THEN 1
        WHEN 'en_revision' THEN 2
        WHEN 'revisado' THEN 3
        ELSE 4
    END;

-- 7. Ver historial de cambios de estado de planes
SELECT 
    hep.id,
    hep."causaRiesgoId",
    hep.estado,
    hep.responsable,
    hep."fechaEstado",
    hep.detalle,
    pa.descripcion as plan_descripcion
FROM "HistorialEstadoPlan" hep
LEFT JOIN "PlanAccion" pa ON hep."causaRiesgoId" = pa."causaRiesgoId"
ORDER BY hep."fechaEstado" DESC
LIMIT 20;

-- 8. Verificar si hay usuarios sin rol asignado
SELECT 
    id,
    username,
    email,
    "fullName",
    role
FROM "Usuario"
WHERE role IS NULL OR role = '';
