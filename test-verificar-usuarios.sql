-- VERIFICAR USUARIOS DISPONIBLES EN LA BASE DE DATOS
-- Para obtener credenciales de prueba

-- Ver todos los usuarios activos
SELECT 
  id,
  nombre,
  email,
  "roleTexto" as role_texto,
  activo
FROM "Usuario"
WHERE activo = true
ORDER BY id
LIMIT 10;

-- Ver roles disponibles
SELECT 
  id,
  codigo,
  nombre,
  descripcion
FROM "Role"
ORDER BY id;

-- Ver usuarios con sus roles
SELECT 
  u.id,
  u.nombre,
  u.email,
  r.codigo as role_codigo,
  r.nombre as role_nombre,
  u.activo
FROM "Usuario" u
JOIN "Role" r ON u."roleId" = r.id
WHERE u.activo = true
ORDER BY u.id
LIMIT 10;
