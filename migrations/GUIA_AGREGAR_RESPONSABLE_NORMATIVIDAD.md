# Guía: Agregar campo Responsable a Normatividad

## Descripción
Esta migración agrega el campo `responsable` a la tabla `Normatividad` para almacenar el responsable cuando el cumplimiento es "Parcial".

## Pasos para ejecutar la migración

### Opción 1: Usando pgAdmin (Recomendado)

1. Abre pgAdmin y conéctate a tu base de datos
2. Navega a tu base de datos en el árbol de la izquierda
3. Click derecho en la base de datos → "Query Tool"
4. Abre el archivo `add_responsable_normatividad.sql`
5. Copia y pega el contenido en el Query Tool
6. Ejecuta la consulta (F5 o botón "Execute")
7. Verifica que aparezca el mensaje de éxito y la columna en los resultados

### Opción 2: Usando Prisma CLI

```bash
cd gestion_riesgos_backend
npx prisma db push
```

Este comando sincronizará el schema de Prisma con la base de datos.

### Opción 3: Usando psql

```bash
psql -U tu_usuario -d nombre_base_datos -f migrations/add_responsable_normatividad.sql
```

## Verificación

Después de ejecutar la migración, verifica que la columna se agregó correctamente:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Normatividad'
AND column_name = 'responsable';
```

Deberías ver:
- column_name: responsable
- data_type: text
- is_nullable: YES

## Rollback (si es necesario)

Si necesitas revertir la migración:

```sql
ALTER TABLE "Normatividad" DROP COLUMN IF EXISTS "responsable";
```

## Notas
- El campo es opcional (nullable)
- Solo se llena cuando el cumplimiento es "Parcial"
- No afecta los registros existentes (se quedan con NULL)
