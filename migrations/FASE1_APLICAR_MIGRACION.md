# 🚀 Fase 1: Aplicar Migración de Base de Datos

## ✅ Archivos Preparados

1. **add_trazabilidad_causariesgo.sql** - Script SQL de migración
2. **schema.prisma** - Schema actualizado de Prisma
3. **FASE1_APLICAR_MIGRACION.md** - Esta guía

---

## 📋 Resumen de Cambios

### Tabla Nueva:
- ✅ `AlertaVencimiento` - Para alertas de vencimiento de planes

### Tabla Modificada:
- ✅ `Control` - Agregados 2 campos: `causaRiesgoOrigenId`, `fechaCreacionDesdePlan`

### Índices Nuevos:
- ✅ 5 índices en `AlertaVencimiento`
- ✅ 1 índice en `Control`
- ✅ 2 índices en `CausaRiesgo` (para optimizar búsquedas en JSON)

### Datos Existentes:
- ✅ **NO se modifican** - Todos los planes en `CausaRiesgo.gestion` quedan intactos

---

## 🎯 Paso a Paso

### Paso 1: Backup (OBLIGATORIO)

En pgAdmin:
1. Clic derecho en tu base de datos `riesgos_db`
2. **Backup...**
3. Nombre: `backup_antes_trazabilidad_YYYYMMDD.backup`
4. Format: **Custom**
5. **Backup**

### Paso 2: Verificar Estado Actual

Ejecuta esta query para confirmar que las tablas/campos NO existen aún:

```sql
-- Verificar que AlertaVencimiento NO existe
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'AlertaVencimiento';
-- Debe retornar: 0

-- Verificar que Control NO tiene los campos nuevos
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Control' 
  AND column_name IN ('causaRiesgoOrigenId', 'fechaCreacionDesdePlan');
-- Debe retornar: 0 filas
```

### Paso 3: Aplicar Migración

1. Abre el archivo `add_trazabilidad_causariesgo.sql` en pgAdmin
2. Copia TODO el contenido (desde `BEGIN;` hasta el último `COMMIT;`)
3. Pégalo en Query Tool
4. **Ejecuta** (F5)

**Resultado esperado:**
```
BEGIN
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
ALTER TABLE
CREATE INDEX
COMMIT
Query returned successfully in XXX msec.
```

### Paso 4: Verificar que Funcionó

El script incluye queries de verificación al final. Deberías ver:

**Query 1: Tabla AlertaVencimiento**
```
total_alertas
-------------
0
```

**Query 2: Campos en Control**
```
column_name              | data_type | is_nullable
-------------------------|-----------|------------
causaRiesgoOrigenId      | integer   | YES
fechaCreacionDesdePlan   | timestamp | YES
```

**Query 3: Índices creados**
```
Debe mostrar ~8 índices nuevos
```

**Query 4: Causas con planes**
```
total_causas_con_plan | solo_plan | plan_y_control
----------------------|-----------|---------------
XX                    | XX        | XX
```

### Paso 5: Actualizar Prisma Client

En tu terminal (backend):

```bash
cd gestion_riesgos_backend
npx prisma generate
```

Esto regenera el cliente de Prisma con los nuevos modelos.

---

## ✅ Checklist de Verificación

- [ ] Backup creado y guardado
- [ ] Migración ejecutada sin errores
- [ ] Tabla `AlertaVencimiento` existe con 0 registros
- [ ] Tabla `Control` tiene 2 campos nuevos
- [ ] ~8 índices nuevos creados
- [ ] Prisma client regenerado
- [ ] Aplicación backend sigue funcionando

---

## 🔍 Queries Útiles Post-Migración

### Ver planes existentes con sus datos:
```sql
SELECT 
    cr.id as causa_id,
    cr."riesgoId",
    r."numeroIdentificacion" as riesgo_numero,
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    cr.gestion->>'planDescripcion' as plan_descripcion,
    cr.gestion->>'planResponsable' as plan_responsable,
    cr.gestion->>'planFechaEstimada' as plan_fecha_estimada,
    cr.gestion->>'planEstado' as plan_estado
FROM "CausaRiesgo" cr
LEFT JOIN "Riesgo" r ON r.id = cr."riesgoId"
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
  AND cr.gestion IS NOT NULL
ORDER BY cr."riesgoId", cr.id
LIMIT 20;
```

### Buscar planes próximos a vencer:
```sql
SELECT 
    cr.id,
    cr."riesgoId",
    r."numeroIdentificacion",
    cr.gestion->>'planDescripcion' as plan,
    cr.gestion->>'planFechaEstimada' as fecha_estimada,
    cr.gestion->>'planEstado' as estado,
    (cr.gestion->>'planFechaEstimada')::date - CURRENT_DATE as dias_restantes
FROM "CausaRiesgo" cr
LEFT JOIN "Riesgo" r ON r.id = cr."riesgoId"
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
  AND cr.gestion->>'planFechaEstimada' IS NOT NULL
  AND cr.gestion->>'planEstado' NOT IN ('completado', 'cancelado')
  AND (cr.gestion->>'planFechaEstimada')::date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY (cr.gestion->>'planFechaEstimada')::date;
```

---

## ❌ Si Algo Sale Mal (Rollback)

Si la migración falla o necesitas revertir:

```sql
BEGIN;

-- Eliminar tabla AlertaVencimiento
DROP TABLE IF EXISTS "AlertaVencimiento" CASCADE;

-- Eliminar foreign key y constraint de Control
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_causaRiesgoOrigenId_fkey";
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_causaRiesgoOrigenId_key";

-- Eliminar índices
DROP INDEX IF EXISTS "Control_causaRiesgoOrigenId_idx";
DROP INDEX IF EXISTS "CausaRiesgo_tipoGestion_idx";
DROP INDEX IF EXISTS "CausaRiesgo_gestion_gin_idx";

-- Eliminar columnas de Control
ALTER TABLE "Control" DROP COLUMN IF EXISTS "causaRiesgoOrigenId";
ALTER TABLE "Control" DROP COLUMN IF EXISTS "fechaCreacionDesdePlan";

COMMIT;
```

Luego restaura desde el backup si es necesario.

---

## 🎯 Próximos Pasos

Una vez completada la Fase 1:

1. ✅ **Fase 1 completada**: Base de datos extendida
2. ⏭️ **Fase 2**: Implementar endpoints API
3. ⏭️ **Fase 3**: Adaptar frontend existente
4. ⏭️ **Fase 4**: Implementar cron job para alertas
5. ⏭️ **Fase 5**: Testing y despliegue

---

## 📊 Tiempo Estimado

- Backup: 1-2 minutos
- Verificación: 30 segundos
- Migración: 5-10 segundos
- Verificación post-migración: 1 minuto
- Regenerar Prisma: 30 segundos

**Total: ~5 minutos**

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los mensajes de error
2. Verifica que estás conectado a la BD correcta
3. Confirma que tienes permisos de administrador
4. Comparte el error específico para ayuda

