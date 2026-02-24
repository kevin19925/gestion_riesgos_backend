# Solución Rápida: Crear Tabla Role sin Migración de Prisma

## Problema
- Prisma migrate falla por problemas con shadow database
- La tabla `Role` no existe en la base de datos

## Solución: Script SQL Directo

Usa el script `crear_tabla_roles_y_migrar.sql` que crea todo directamente en la base de datos.

### Paso 1: Ejecutar el Script SQL

**Opción A: Desde psql (línea de comandos)**
```bash
psql -h dpg-d6594i56ubrc738u5tk0-a.oregon-postgres.render.com -U tu_usuario -d riesgos_db_cv8c -f gestion_riesgos_backend/scripts/crear_tabla_roles_y_migrar.sql
```

**Opción B: Desde pgAdmin o cualquier cliente SQL**
1. Abre el archivo `gestion_riesgos_backend/scripts/crear_tabla_roles_y_migrar.sql`
2. Cópialo y pégalo en tu cliente SQL
3. Ejecútalo

**Opción C: Desde el terminal de PostgreSQL (si tienes acceso)**
```bash
cd gestion_riesgos_backend
psql "postgresql://usuario:password@dpg-d6594i56ubrc738u5tk0-a.oregon-postgres.render.com:5432/riesgos_db_cv8c" -f scripts/crear_tabla_roles_y_migrar.sql
```

### Paso 2: Sincronizar Prisma con la Base de Datos

Después de ejecutar el script SQL, sincroniza Prisma:

```bash
cd gestion_riesgos_backend
npx prisma db pull
npx prisma generate
```

Esto actualizará el schema de Prisma para que coincida con la base de datos.

### Paso 3: Verificar

Ejecuta estas consultas para verificar:

```sql
-- Ver roles creados
SELECT * FROM "Role";

-- Ver usuarios con sus roles
SELECT u.id, u.nombre, u.email, r.codigo, r.nombre as rol_nombre 
FROM "Usuario" u 
LEFT JOIN "Role" r ON u."roleId" = r.id;
```

## ¿Por qué este enfoque?

El script SQL directo:
- ✅ Crea la tabla `Role` si no existe
- ✅ Agrega la columna `roleId` a `Usuario` si no existe
- ✅ Crea los 4 roles base
- ✅ Migra todos los usuarios existentes
- ✅ Configura todas las restricciones necesarias
- ✅ No depende de la shadow database de Prisma

Después de ejecutarlo, Prisma se sincronizará automáticamente con `prisma db pull`.

