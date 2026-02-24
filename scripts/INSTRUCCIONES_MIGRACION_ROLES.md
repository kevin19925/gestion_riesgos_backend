# Instrucciones para Migrar a Sistema de Roles

## Paso 1: Ejecutar Migración de Prisma

Primero, necesitas crear y aplicar la migración de Prisma para crear la tabla `Role` y actualizar la tabla `Usuario`:

```bash
cd gestion_riesgos_backend
npx prisma migrate dev --name add_roles_table
```

Esto creará:
- La tabla `Role` con los campos necesarios
- Actualizará la tabla `Usuario` para cambiar `role` (String) por `roleId` (Int, relación con Role)

## Paso 2: Ejecutar Script SQL de Migración de Datos

Una vez que la migración de Prisma se haya aplicado correctamente, ejecuta el script SQL:

```bash
# Opción 1: Desde psql
psql -U tu_usuario -d tu_base_de_datos -f scripts/migrar_roles.sql

# Opción 2: Desde pgAdmin o cualquier cliente SQL
# Abre el archivo scripts/migrar_roles.sql y ejecútalo
```

El script SQL:
1. Verificará que la tabla `Role` existe
2. Creará los 4 roles base (admin, dueño_procesos, gerente, supervisor)
3. Migrará los usuarios existentes mapeando sus roles antiguos a los nuevos:
   - `admin` → `admin`
   - `dueño_procesos` → `dueño_procesos`
   - `supervisor` → `supervisor`
   - `gerente_general`, `manager` → `gerente`
   - `director_procesos`, `analyst` → `supervisor`

## Paso 3: Verificar la Migración

Ejecuta estas consultas para verificar que todo está correcto:

```sql
-- Verificar que los roles se crearon
SELECT * FROM "Role";

-- Verificar que los usuarios tienen roleId asignado
SELECT u.id, u.nombre, u.email, r.codigo, r.nombre as rol_nombre 
FROM "Usuario" u 
LEFT JOIN "Role" r ON u."roleId" = r.id;

-- Verificar usuarios sin rol (debería ser 0)
SELECT COUNT(*) as usuarios_sin_rol
FROM "Usuario"
WHERE "roleId" IS NULL;
```

## Solución de Problemas

### Error: "relation Role does not exist"
**Solución:** Aún no has ejecutado la migración de Prisma. Ejecuta el Paso 1 primero.

### Error: "column role does not exist" al ejecutar el script SQL
**Solución:** Esto significa que la migración de Prisma ya eliminó la columna `role`. El script SQL está intentando migrar datos desde una columna que ya no existe. En este caso, necesitas:
1. Verificar qué usuarios existen en la base de datos
2. Asignarles manualmente un `roleId` basado en algún criterio (por ejemplo, todos los usuarios activos podrían ser `supervisor`)

### Error: "duplicate key value violates unique constraint"
**Solución:** Los roles ya existen. Esto es normal si ejecutas el script múltiples veces. El script usa `WHERE NOT EXISTS` para evitar duplicados.

## Notas Importantes

- **Backup:** Siempre haz un backup de tu base de datos antes de ejecutar migraciones
- **Orden:** Es crítico ejecutar primero la migración de Prisma y luego el script SQL
- **Datos:** El script SQL preserva todos los usuarios existentes, solo actualiza sus roles

