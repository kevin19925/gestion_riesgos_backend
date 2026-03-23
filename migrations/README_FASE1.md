# 🚀 Fase 1: Extensión de Base de Datos

## 📦 Archivos Creados

1. **add_plan_trazabilidad.sql** - Script SQL de migración
2. **verificar_antes_migracion.sql** - Verificación pre-migración
3. **aplicar_migracion.js** - Script Node.js con confirmación
4. **FASE1_MIGRACION_EXPLICACION.md** - Documentación detallada
5. **README_FASE1.md** - Este archivo

## ⚡ Opción Rápida (Recomendada)

Si confías en el proceso automatizado:

```bash
cd gestion_riesgos_backend
node migrations/aplicar_migracion.js
```

Este script:
- ✅ Verifica el estado actual
- ✅ Pide confirmación
- ✅ Aplica la migración en transacción
- ✅ Verifica que todo funcionó
- ✅ Hace rollback automático si algo falla

---

## 🔍 Opción Manual (Paso a Paso)

Si prefieres control total:

### Paso 1: Verificar Estado Actual

```bash
cd gestion_riesgos_backend

# Opción A: Con psql
psql -h [host] -U [usuario] -d riesgos_db -f migrations/verificar_antes_migracion.sql

# Opción B: Con tu herramienta GUI favorita
# Abre y ejecuta: migrations/verificar_antes_migracion.sql
```

**Verifica que:**
- ✅ Las columnas nuevas NO existen aún
- ✅ La tabla AlertaVencimiento NO existe
- ✅ Tienes el conteo actual de registros

---

### Paso 2: Hacer Backup (IMPORTANTE)

```bash
# Backup completo
pg_dump -h [host] -U [usuario] -d riesgos_db > backup_$(date +%Y%m%d_%H%M%S).sql

# O solo las tablas que vamos a modificar
pg_dump -h [host] -U [usuario] -d riesgos_db -t PlanAccion -t Control > backup_planes_controles.sql
```

---

### Paso 3: Aplicar Migración

```bash
# Opción A: Con psql
psql -h [host] -U [usuario] -d riesgos_db -f migrations/add_plan_trazabilidad.sql

# Opción B: Con tu herramienta GUI
# Abre y ejecuta: migrations/add_plan_trazabilidad.sql
```

---

### Paso 4: Verificar que Funcionó

Ejecuta las queries de verificación al final del archivo `add_plan_trazabilidad.sql`:

```sql
-- Verificar columnas nuevas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'PlanAccion' 
  AND column_name IN ('controlDerivadoId', 'fechaConversion');

-- Verificar tabla nueva
SELECT COUNT(*) FROM "AlertaVencimiento";
```

**Resultados esperados:**
- ✅ 2 columnas en PlanAccion (ambas nullable)
- ✅ 2 columnas en Control (ambas nullable)
- ✅ Tabla AlertaVencimiento existe con 0 registros

---

## 🔄 Si Algo Sale Mal (Rollback)

### Opción 1: Rollback Automático (Script Node.js)

Si usaste `aplicar_migracion.js`, el rollback es automático en caso de error.

### Opción 2: Rollback Manual

Ejecuta la sección de ROLLBACK del archivo `add_plan_trazabilidad.sql`:

```bash
# Descomentar la sección ROLLBACK del archivo y ejecutar
psql -h [host] -U [usuario] -d riesgos_db -c "
BEGIN;
DROP TABLE IF EXISTS \"AlertaVencimiento\" CASCADE;
ALTER TABLE \"PlanAccion\" DROP CONSTRAINT IF EXISTS \"PlanAccion_controlDerivadoId_fkey\";
ALTER TABLE \"Control\" DROP CONSTRAINT IF EXISTS \"Control_planAccionOrigenId_fkey\";
ALTER TABLE \"PlanAccion\" DROP COLUMN IF EXISTS \"controlDerivadoId\";
ALTER TABLE \"PlanAccion\" DROP COLUMN IF EXISTS \"fechaConversion\";
ALTER TABLE \"Control\" DROP COLUMN IF EXISTS \"planAccionOrigenId\";
ALTER TABLE \"Control\" DROP COLUMN IF EXISTS \"fechaCreacionDesdePlan\";
COMMIT;
"
```

### Opción 3: Restaurar desde Backup

```bash
# Restaurar backup completo
psql -h [host] -U [usuario] -d riesgos_db < backup_[fecha].sql
```

---

## ✅ Checklist de Seguridad

Antes de aplicar en producción:

- [ ] ✅ Ejecuté verificación pre-migración
- [ ] ✅ Hice backup de la base de datos
- [ ] ✅ Probé la migración en ambiente de desarrollo
- [ ] ✅ Verifiqué que la aplicación sigue funcionando después de migrar
- [ ] ✅ Probé el rollback en desarrollo
- [ ] ✅ Tengo el backup accesible por si acaso
- [ ] ✅ Notifiqué al equipo sobre el mantenimiento
- [ ] ✅ Tengo tiempo para revertir si algo sale mal

---

## 📊 Resumen de Cambios

| Tabla | Cambio | Tipo | Impacto |
|-------|--------|------|---------|
| PlanAccion | +2 columnas | Nullable | ✅ Sin impacto |
| Control | +2 columnas | Nullable | ✅ Sin impacto |
| AlertaVencimiento | Nueva tabla | Vacía | ✅ Sin impacto |
| Índices | +7 índices | Performance | ✅ Mejora queries |

---

## 🎯 Después de Aplicar

Una vez completada la Fase 1:

1. ✅ Verifica que la aplicación sigue funcionando
2. ✅ Confirma que no hay errores en logs
3. ✅ Procede con **Fase 2: Migración de Datos** (asignar estados)

---

## 📞 Soporte

Si tienes dudas o problemas:
1. Revisa `FASE1_MIGRACION_EXPLICACION.md` para detalles
2. Ejecuta `verificar_antes_migracion.sql` para diagnóstico
3. Comparte los logs de error para ayuda

---

## ⏱️ Tiempo Estimado

- Verificación: 10 segundos
- Backup: 30 segundos - 2 minutos (según tamaño de BD)
- Migración: 5-10 segundos
- Verificación post-migración: 10 segundos

**Total: ~3-5 minutos**
