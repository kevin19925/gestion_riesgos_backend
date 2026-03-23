# 🎯 Guía de Migración usando pgAdmin

## ✅ Checklist Previo

Antes de empezar, asegúrate de tener:
- [ ] Acceso a pgAdmin con permisos de administrador
- [ ] Conexión a la base de datos `riesgos_db` (o el nombre que uses)
- [ ] Tiempo estimado: 5-10 minutos
- [ ] Ambiente: ¿Es desarrollo o producción?

---

## 📋 Paso 1: Hacer Backup (OBLIGATORIO)

### Opción A: Backup desde pgAdmin (Recomendado)

1. En pgAdmin, haz clic derecho en tu base de datos `riesgos_db`
2. Selecciona **Backup...**
3. Configuración:
   - **Filename**: `backup_trazabilidad_YYYYMMDD_HHMM.backup`
   - **Format**: Custom
   - **Encoding**: UTF8
4. En la pestaña **Dump Options**:
   - ✅ Data
   - ✅ Blobs
   - ✅ Pre-data
   - ✅ Post-data
5. Clic en **Backup**
6. **Espera a que termine** (verás el progreso en la esquina inferior derecha)

### Opción B: Backup solo de tablas afectadas (Más rápido)

1. Clic derecho en la tabla `PlanAccion` → **Backup...**
2. Guarda como `backup_PlanAccion.backup`
3. Repite para tabla `Control`
4. Guarda como `backup_Control.backup`

---

## 🔍 Paso 2: Verificación Pre-Migración

1. En pgAdmin, abre **Query Tool** (clic derecho en tu base de datos → Query Tool)
2. Abre el archivo `verificar_antes_migracion.sql`
3. Copia TODO el contenido y pégalo en el Query Tool
4. Clic en el botón **▶ Execute/Refresh** (o presiona F5)

### ¿Qué debes ver?

✅ **Resultados esperados:**
- Query 1-2: Lista de columnas actuales (NO debe aparecer `controlDerivadoId` ni `planAccionOrigenId`)
- Query 3: Conteo de registros (anota estos números)
- Query 4: Debe decir "✅ No existe (OK para migrar)" en las 3 columnas
- Query 5-6: Distribución de estados y porcentajes de avance
- Query 7: Planes próximos a vencer

⚠️ **Si ves "Ya existe":**
- La migración ya fue aplicada anteriormente
- **NO CONTINÚES** - Contacta al equipo

📸 **Recomendación:** Toma screenshot de los resultados para referencia

---

## 🚀 Paso 3: Aplicar Migración

1. En el mismo Query Tool (o abre uno nuevo)
2. Abre el archivo `add_plan_trazabilidad.sql`
3. Copia TODO el contenido (desde `BEGIN;` hasta el último `COMMIT;`)
4. Pégalo en el Query Tool
5. **REVISA** que el script comience con `BEGIN;` y termine con `COMMIT;`
6. Clic en **▶ Execute/Refresh** (F5)

### ¿Qué debes ver?

✅ **Éxito:**
```
BEGIN
ALTER TABLE
ALTER TABLE
CREATE INDEX
...
COMMIT
Query returned successfully in XXX msec.
```

❌ **Error:**
- Si ves algún error, **NO ENTRES EN PÁNICO**
- La transacción se revierte automáticamente (gracias al `BEGIN;`)
- Copia el mensaje de error completo
- Salta al **Paso 6: Troubleshooting**

---

## ✅ Paso 4: Verificación Post-Migración

El script incluye queries de verificación al final. Deberías ver:

### Query 1: Columnas en PlanAccion
```
column_name          | data_type | is_nullable
---------------------|-----------|------------
controlDerivadoId    | integer   | YES
fechaConversion      | timestamp | YES
```

### Query 2: Columnas en Control
```
column_name              | data_type | is_nullable
-------------------------|-----------|------------
planAccionOrigenId       | integer   | YES
fechaCreacionDesdePlan   | timestamp | YES
```

### Query 3: Tabla AlertaVencimiento
```
total_alertas
-------------
0
```

✅ **Si ves estos resultados: ¡ÉXITO!** La migración se aplicó correctamente.

---

## 🧪 Paso 5: Prueba Rápida

Ejecuta estas queries para confirmar que todo funciona:

```sql
-- 1. Verificar que puedes insertar en la nueva tabla
INSERT INTO "AlertaVencimiento" 
("planAccionId", "usuarioId", "tipo", "diasRestantes", "leida")
VALUES 
(1, 1, 'proximo', 5, false);

-- 2. Verificar que se insertó
SELECT * FROM "AlertaVencimiento";

-- 3. Limpiar la prueba
DELETE FROM "AlertaVencimiento" WHERE id = (SELECT MAX(id) FROM "AlertaVencimiento");

-- 4. Verificar que las relaciones funcionan
SELECT 
    p.id,
    p.descripcion,
    p.controlDerivadoId,
    c.id as control_id
FROM "PlanAccion" p
LEFT JOIN "Control" c ON c."planAccionOrigenId" = p.id
LIMIT 5;
```

✅ **Si todas las queries funcionan: ¡PERFECTO!**

---

## 🎉 Paso 6: Confirmar Éxito

Ejecuta esta query final:

```sql
SELECT 
    'PlanAccion' as tabla,
    COUNT(*) as registros_actuales
FROM "PlanAccion"
UNION ALL
SELECT 
    'Control' as tabla,
    COUNT(*) as registros_actuales
FROM "Control"
UNION ALL
SELECT 
    'AlertaVencimiento' as tabla,
    COUNT(*) as registros_actuales
FROM "AlertaVencimiento";
```

✅ **Compara con los números del Paso 2:**
- PlanAccion: Debe ser el mismo número
- Control: Debe ser el mismo número
- AlertaVencimiento: Debe ser 0

---

## 🔧 Troubleshooting

### Error: "relation already exists"
**Causa:** La migración ya fue aplicada antes.
**Solución:** No hagas nada, ya está migrado.

### Error: "foreign key constraint"
**Causa:** Hay datos inconsistentes en la BD.
**Solución:** 
1. Ejecuta el rollback (ver abajo)
2. Revisa los datos con las queries de verificación
3. Contacta al equipo

### Error: "permission denied"
**Causa:** Tu usuario no tiene permisos suficientes.
**Solución:** Pide a un administrador que ejecute la migración.

---

## ⏪ Rollback (Solo si algo salió mal)

Si necesitas revertir la migración:

1. Abre Query Tool
2. Copia este script:

```sql
BEGIN;

-- Eliminar tabla AlertaVencimiento
DROP TABLE IF EXISTS "AlertaVencimiento" CASCADE;

-- Eliminar foreign keys
ALTER TABLE "PlanAccion" DROP CONSTRAINT IF EXISTS "PlanAccion_controlDerivadoId_fkey";
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_planAccionOrigenId_fkey";

-- Eliminar índices
DROP INDEX IF EXISTS "PlanAccion_estado_idx";
DROP INDEX IF EXISTS "PlanAccion_fechaProgramada_idx";
DROP INDEX IF EXISTS "PlanAccion_controlDerivadoId_idx";
DROP INDEX IF EXISTS "Control_planAccionOrigenId_idx";
DROP INDEX IF EXISTS "AlertaVencimiento_planAccionId_idx";
DROP INDEX IF EXISTS "AlertaVencimiento_usuarioId_idx";
DROP INDEX IF EXISTS "AlertaVencimiento_leida_idx";
DROP INDEX IF EXISTS "AlertaVencimiento_fechaGeneracion_idx";
DROP INDEX IF EXISTS "AlertaVencimiento_tipo_idx";

-- Eliminar constraints de unicidad
ALTER TABLE "PlanAccion" DROP CONSTRAINT IF EXISTS "PlanAccion_controlDerivadoId_key";
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_planAccionOrigenId_key";

-- Eliminar columnas
ALTER TABLE "PlanAccion" DROP COLUMN IF EXISTS "controlDerivadoId";
ALTER TABLE "PlanAccion" DROP COLUMN IF EXISTS "fechaConversion";
ALTER TABLE "Control" DROP COLUMN IF EXISTS "planAccionOrigenId";
ALTER TABLE "Control" DROP COLUMN IF EXISTS "fechaCreacionDesdePlan";

COMMIT;
```

3. Ejecuta (F5)
4. Verifica que todo volvió al estado original

---

## 📊 Resumen de Cambios Aplicados

| Elemento | Acción | Detalles |
|----------|--------|----------|
| **PlanAccion** | +2 columnas | `controlDerivadoId`, `fechaConversion` |
| **Control** | +2 columnas | `planAccionOrigenId`, `fechaCreacionDesdePlan` |
| **AlertaVencimiento** | Nueva tabla | 10 columnas, 5 índices |
| **Índices** | +7 índices | Optimización de queries |
| **Foreign Keys** | +4 constraints | Integridad referencial |

---

## ✅ Checklist Final

Después de aplicar la migración:

- [ ] ✅ Backup creado y guardado
- [ ] ✅ Verificación pre-migración ejecutada
- [ ] ✅ Migración aplicada sin errores
- [ ] ✅ Verificación post-migración exitosa
- [ ] ✅ Pruebas rápidas funcionando
- [ ] ✅ Conteo de registros coincide
- [ ] ✅ Aplicación backend sigue funcionando
- [ ] ✅ No hay errores en logs

---

## 🎯 Próximos Pasos

Una vez completada esta migración:

1. ✅ **Fase 1 completada**: Base de datos extendida
2. ⏭️ **Fase 2**: Migración de datos (asignar estados a planes existentes)
3. ⏭️ **Fase 3**: Implementar endpoints API
4. ⏭️ **Fase 4**: Conectar frontend con backend real

---

## 📞 Soporte

Si tienes dudas o problemas:
- Revisa la sección de Troubleshooting
- Comparte screenshots de los errores
- Indica en qué paso estás

**Tiempo total estimado: 5-10 minutos**
