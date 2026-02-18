# 📋 Instrucciones: Múltiples Responsables por Proceso

## ✅ Implementación Completada

Se ha implementado el soporte para **múltiples responsables por proceso** sin borrar ningún dato existente.

## 🔄 Pasos para Activar

### 1. Ejecutar el Script de Migración SQL

**IMPORTANTE:** Este script NO borra datos, solo agrega la nueva funcionalidad.

```bash
# Desde pgAdmin o línea de comandos
psql -h tu_host -U tu_usuario -d tu_base_de_datos -f scripts/migrar_responsables_multiples.sql
```

O desde pgAdmin:
1. Abre pgAdmin
2. Conéctate a tu base de datos
3. Abre Query Tool
4. Copia y pega el contenido de `scripts/migrar_responsables_multiples.sql`
5. Ejecuta (F5)

### 2. Actualizar Prisma Client

```bash
cd gestion_riesgos_backend
npx prisma generate
```

### 3. Reiniciar el Backend

```bash
npm run dev
```

### 4. Verificar que Funciona

El backend ahora incluye estos nuevos endpoints:

- `GET /api/procesos/:procesoId/responsables` - Obtener responsables
- `POST /api/procesos/:procesoId/responsables` - Agregar responsable
- `DELETE /api/procesos/:procesoId/responsables/:usuarioId` - Eliminar responsable
- `PUT /api/procesos/:procesoId/responsables` - Actualizar lista completa

## 📊 Cambios Realizados

### Backend

1. **Schema Prisma** (`prisma/schema.prisma`):
   - ✅ Agregada tabla `ProcesoResponsable` (muchos-a-muchos)
   - ✅ Mantenido campo `responsableId` por compatibilidad
   - ✅ Agregada relación `responsables` en `Proceso`

2. **Controladores**:
   - ✅ `procesos.controller.ts`: Incluye `responsables` en las consultas
   - ✅ `proceso-responsables.controller.ts`: Nuevo controlador para gestionar responsables

3. **Rutas**:
   - ✅ `proceso-responsables.routes.ts`: Nuevas rutas para responsables
   - ✅ Integradas en `routes/index.ts`

### Scripts SQL

1. ✅ `migrar_responsables_multiples.sql`: Migra datos existentes sin borrar nada
2. ✅ `README_MIGRACION_RESPONSABLES.md`: Documentación completa

## 🔒 Seguridad de Datos

- ✅ **NO se borran datos**: El campo `responsableId` se mantiene intacto
- ✅ **NO se pierden responsables**: Todos se migran a la nueva tabla
- ✅ **Es seguro ejecutar múltiples veces**: Usa `ON CONFLICT DO NOTHING`
- ✅ **Datos originales preservados**: Todo queda como estaba

## 📝 Próximos Pasos (Frontend)

El frontend necesita actualizarse para:

1. Mostrar múltiples responsables en la UI
2. Permitir agregar/eliminar responsables desde `AreasPage.tsx`
3. Usar los nuevos endpoints en lugar de solo `responsableId`

¿Quieres que actualice también el frontend ahora?

