# Guía: Ejecutar Migración de Reuniones y Asistentes

## Paso 1: Abrir pgAdmin y conectarse a la base de datos

1. Abrir pgAdmin
2. Conectarse al servidor PostgreSQL
3. Navegar a la base de datos del proyecto (generalmente `gestion_riesgos` o similar)

## Paso 2: Abrir Query Tool

1. Click derecho en la base de datos
2. Seleccionar "Query Tool"

## Paso 3: Ejecutar la migración

1. Abrir el archivo `create_reuniones_tables.sql` en un editor de texto
2. Copiar TODO el contenido del archivo
3. Pegarlo en el Query Tool de pgAdmin
4. Click en el botón "Execute/Run" (▶️) o presionar F5

## Paso 4: Verificar que las tablas se crearon

Ejecutar esta consulta en el Query Tool:

```sql
SELECT 
    tablename, 
    schemaname 
FROM pg_tables 
WHERE tablename IN ('AsistentesProceso', 'ReunionProceso', 'AsistenciaReunion')
ORDER BY tablename;
```

Deberías ver 3 filas con las tablas:
- AsistentesProceso
- ReunionProceso
- AsistenciaReunion

## Paso 5: Verificar las columnas de cada tabla

```sql
-- Verificar columnas de AsistentesProceso
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'AsistentesProceso'
ORDER BY ordinal_position;

-- Verificar columnas de ReunionProceso
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ReunionProceso'
ORDER BY ordinal_position;

-- Verificar columnas de AsistenciaReunion
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'AsistenciaReunion'
ORDER BY ordinal_position;
```

## Paso 6: Regenerar el cliente Prisma

Después de ejecutar la migración SQL, debes regenerar el cliente Prisma:

1. Abrir terminal en la carpeta `gestion_riesgos_backend`
2. Ejecutar:

```bash
npx prisma generate
```

## Paso 7: Reiniciar el backend

```bash
npm run dev
```

## Verificación Final

El backend debería iniciar sin errores. Verifica en la consola que no haya errores de TypeScript relacionados con los nuevos modelos.

## Estructura de las Tablas Creadas

### AsistentesProceso
- `id`: ID único
- `procesoId`: ID del proceso (FK a Proceso)
- `usuarioId`: ID del usuario (FK a Usuario)
- `rol`: Rol del asistente ('dueño_procesos' o 'supervisor_riesgos')
- `createdAt`: Fecha de creación

### ReunionProceso
- `id`: ID único
- `procesoId`: ID del proceso (FK a Proceso)
- `fecha`: Fecha de la reunión
- `descripcion`: Descripción/agenda de la reunión
- `estado`: Estado ('programada', 'realizada', 'cancelada')
- `createdAt`: Fecha de creación
- `updatedAt`: Fecha de última actualización

### AsistenciaReunion
- `id`: ID único
- `reunionId`: ID de la reunión (FK a ReunionProceso)
- `usuarioId`: ID del usuario (FK a Usuario)
- `asistio`: Booleano indicando si asistió
- `observaciones`: Observaciones opcionales
- `registradoEn`: Fecha de registro de la asistencia

## Troubleshooting

### Error: "relation already exists"
Si ves este error, significa que las tablas ya existen. Puedes:
1. Eliminar las tablas existentes y volver a ejecutar la migración
2. O verificar que las tablas existentes tengan la estructura correcta

### Error al regenerar Prisma
Si hay errores al ejecutar `npx prisma generate`:
1. Verifica que el archivo `schema.prisma` esté actualizado
2. Verifica que las tablas existan en la base de datos
3. Intenta ejecutar `npx prisma db pull` para sincronizar el schema con la BD

### Backend no inicia
Si el backend no inicia después de la migración:
1. Verifica los logs de error en la consola
2. Asegúrate de que el cliente Prisma se haya regenerado correctamente
3. Verifica que las rutas estén registradas en `src/routes/index.ts`
