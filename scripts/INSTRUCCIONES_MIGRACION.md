# Instrucciones de Migración: Asignaciones Independientes por Modo

## 📋 Resumen

Esta migración permite que las asignaciones de procesos sean independientes entre "Modo Director" y "Modo Proceso", sin sincronización automática.

**Cambio principal:** Modificar constraint único de `UNIQUE(procesoId, usuarioId)` a `UNIQUE(procesoId, usuarioId, modo)`

**Resultado:** Podrás asignar procesos diferentes O iguales en cada modo, con total flexibilidad.

## ⏱️ Tiempo Estimado

- Verificación: 2 minutos
- Backup: 3 minutos
- Migración: 1 minuto
- Verificación post-migración: 2 minutos
- **Total: ~8 minutos**

## 🔧 Requisitos Previos

- Acceso a la base de datos PostgreSQL (Azure)
- Cliente SQL (pgAdmin, DBeaver, Azure Data Studio, o psql)
- Permisos de ALTER TABLE en la base de datos

## 📁 Archivos Incluidos

1. `verificar-estado-actual.sql` - Verificar estado antes de migrar
2. `01-migracion-modo-independiente.sql` - Script principal de migración
3. `02-rollback-migracion.sql` - Script de rollback (por si algo falla)
4. `INSTRUCCIONES_MIGRACION.md` - Este archivo

---

## 🚀 PASO A PASO

### PASO 1: Verificar Estado Actual (2 min)

Ejecuta el archivo `verificar-estado-actual.sql` en tu cliente SQL.

**Qué buscar:**
- Nombre exacto de la tabla (ProcesoResponsable)
- Constraint único actual
- Cantidad de registros con modo "ambos" o NULL
- Estructura de columnas

**Ejemplo de resultado esperado:**
```
tablename: ProcesoResponsable
constraint_name: ProcesoResponsable_procesoId_usuarioId_key
columns: procesoId, usuarioId
```

### PASO 2: Hacer Backup (3 min)

**Opción A: Backup completo de la tabla**
```sql
-- Crear tabla de backup
CREATE TABLE "ProcesoResponsable_backup_20260227" AS 
SELECT * FROM "ProcesoResponsable";

-- Verificar backup
SELECT COUNT(*) FROM "ProcesoResponsable_backup_20260227";
```

**Opción B: Export a archivo (recomendado)**
```bash
# Desde línea de comandos
pg_dump -h data-base-src.postgres.database.azure.com \
  -U azureuser \
  -d riesgos_db \
  -t "ProcesoResponsable" \
  --data-only \
  > backup_proceso_responsable_20260227.sql
```

### PASO 3: Ejecutar Migración (1 min)

Ejecuta el archivo `01-migracion-modo-independiente.sql` completo.

**El script hace:**
1. ✅ Duplica registros con modo "ambos" → crea uno "director" y uno "proceso"
2. ✅ Elimina registros antiguos con modo "ambos" o NULL
3. ✅ Cambia constraint único para incluir modo
4. ✅ Hace campo modo obligatorio (NOT NULL)
5. ✅ Verifica resultado final

**Salida esperada:**
```
NOTICE: === ESTADO ACTUAL ===
NOTICE: Total registros: 45
NOTICE: Registros con modo "ambos": 45
NOTICE: === DUPLICANDO REGISTROS ===
NOTICE: Registros con modo "director": 45
NOTICE: Registros con modo "proceso": 45
NOTICE: === ELIMINANDO REGISTROS ANTIGUOS ===
NOTICE: Registros antiguos eliminados correctamente
NOTICE: === MODIFICANDO CONSTRAINT ÚNICO ===
NOTICE: Constraint único actualizado: (procesoId, usuarioId, modo)
NOTICE: === RESULTADO FINAL ===
NOTICE: Total registros: 90
NOTICE: Modo "director": 45
NOTICE: Modo "proceso": 45
NOTICE: Duplicados encontrados: 0
NOTICE: ✓ Migración completada exitosamente
```

### PASO 4: Verificar Resultado (2 min)

Ejecuta estas queries para verificar:

```sql
-- 1. Ver distribución de modos
SELECT 
    modo,
    COUNT(*) as cantidad
FROM "ProcesoResponsable"
GROUP BY modo;

-- 2. Verificar constraint nuevo
SELECT 
    tc.constraint_name,
    STRING_AGG(kcu.column_name, ', ') as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'ProcesoResponsable'
AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name;

-- 3. Probar inserción (debe funcionar)
-- Esto debe permitirse ahora:
INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo")
VALUES (999, 999, 'director');

INSERT INTO "ProcesoResponsable" ("procesoId", "usuarioId", "modo")
VALUES (999, 999, 'proceso');

-- Limpiar prueba
DELETE FROM "ProcesoResponsable" WHERE "procesoId" = 999;
```

**Resultado esperado:**
- ✅ Ambos INSERT funcionan sin error
- ✅ Constraint incluye: procesoId, usuarioId, modo
- ✅ Total registros = registros originales × 2

---

## ⚠️ Si Algo Sale Mal

### Opción 1: Rollback Automático

Si la migración falla, ejecuta `02-rollback-migracion.sql`

Este script:
- Revierte el constraint al original
- Consolida registros duplicados a modo "ambos"
- Restaura el estado anterior

### Opción 2: Restaurar desde Backup

```sql
-- Si creaste tabla de backup
DROP TABLE "ProcesoResponsable";
ALTER TABLE "ProcesoResponsable_backup_20260227" 
RENAME TO "ProcesoResponsable";

-- Si exportaste a archivo
psql -h data-base-src.postgres.database.azure.com \
  -U azureuser \
  -d riesgos_db \
  < backup_proceso_responsable_20260227.sql
```

---

## ✅ Checklist Post-Migración

- [ ] Migración ejecutada sin errores
- [ ] Constraint único incluye modo
- [ ] Campo modo es NOT NULL
- [ ] Total registros = registros originales × 2
- [ ] Distribución: 50% director, 50% proceso
- [ ] Prueba de inserción funciona
- [ ] Backend actualizado (siguiente paso)
- [ ] Frontend actualizado (siguiente paso)
- [ ] Pruebas funcionales completas

---

## 📞 Soporte

Si encuentras problemas:
1. NO ejecutes más comandos
2. Guarda el mensaje de error completo
3. Verifica el backup está disponible
4. Consulta antes de continuar

---

## 🎯 Próximos Pasos

Después de completar la migración de BD:

1. **Actualizar Prisma Schema** (5 min)
2. **Modificar Backend** (30 min)
3. **Modificar Frontend** (45 min)
4. **Testing Completo** (15 min)

Ver documentación en `.kiro/specs/asignaciones-independientes-por-modo/` 