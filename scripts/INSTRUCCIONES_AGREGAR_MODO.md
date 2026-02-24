# Instrucciones para Agregar Campo 'modo' a ProcesoResponsable

## Problema
El endpoint `/api/procesos` está devolviendo error 500 porque el campo `modo` no existe en la tabla `ProcesoResponsable`.

## Solución: Ejecutar Script SQL

### Opción 1: Desde pgAdmin o cualquier cliente SQL

1. Abre pgAdmin o tu cliente SQL favorito
2. Conéctate a tu base de datos de Render:
   - Host: `dpg-d6594i56ubrc738u5tk0-a.oregon-postgres.render.com`
   - Database: `riesgos_db_cv8c`
   - Usuario: (el que tengas configurado)
   - Puerto: 5432
   - SSL: Requerido

3. Abre el archivo `gestion_riesgos_backend/scripts/agregar_campo_modo_proceso_responsable.sql`
4. Copia todo el contenido
5. Pégalo en el Query Tool de pgAdmin
6. Ejecuta el script (F5 o botón "Execute")

### Opción 2: Desde línea de comandos (psql)

```bash
cd gestion_riesgos_backend
psql "postgresql://usuario:password@dpg-d6594i56ubrc738u5tk0-a.oregon-postgres.render.com:5432/riesgos_db_cv8c?sslmode=require" -f scripts/agregar_campo_modo_proceso_responsable.sql
```

## Verificación

Después de ejecutar el script, verifica que la columna se creó:

```sql
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ProcesoResponsable' 
AND column_name = 'modo';
```

Deberías ver una fila con:
- column_name: `modo`
- data_type: `character varying`
- character_maximum_length: `20`
- is_nullable: `YES`

## Reiniciar el Backend

Después de ejecutar el script, reinicia el servidor backend para que los cambios surtan efecto.

