# Guía: Restaurar Controles desde Backup usando pgAdmin

**Objetivo**: Restaurar el backup en una base de datos temporal y extraer los controles reales.

---

## 📋 Paso 1: Crear Base de Datos Temporal

1. Abrir **pgAdmin**
2. Clic derecho en **Databases**
3. Seleccionar **Create > Database...**
4. Configurar:
   - **Database**: `temp_backup_pre_migracion`
   - **Owner**: `postgres` (o tu usuario)
   - **Encoding**: `UTF8`
5. Clic en **Save**

---

## 📥 Paso 2: Restaurar el Backup en la Base Temporal

1. En pgAdmin, clic derecho en la base de datos **temp_backup_pre_migracion**
2. Seleccionar **Restore...**
3. En la ventana de Restore:
   - **Format**: `Custom or tar`
   - **Filename**: Clic en el botón `...` y navegar a:
     ```
     gestion_riesgos_backend/migrations/riesgosdb_antes_migracion
     ```
   - **Role name**: `postgres` (o tu usuario)
4. En la pestaña **Restore options**:
   - ✅ Marcar: `Pre-data`
   - ✅ Marcar: `Data`
   - ✅ Marcar: `Post-data`
   - ⚠️ **IMPORTANTE**: Desmarcar `Owner` (para evitar problemas de permisos)
5. Clic en **Restore**
6. Esperar a que termine (puede tardar 1-2 minutos)

**Resultado esperado**: 
- Mensaje: "Restore completed successfully"
- La base de datos `temp_backup_pre_migracion` ahora tiene todos los datos del backup

---

## 🔍 Paso 3: Verificar Datos del Backup

Conectarse a **temp_backup_pre_migracion** y ejecutar:

```sql
-- Ver estructura de CausaRiesgo
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;

-- Contar causas con controles
SELECT 
    COUNT(*) as total_causas,
    COUNT(CASE WHEN "puntajeTotal" IS NOT NULL THEN 1 END) as con_control,
    COUNT(CASE WHEN "evaluacionDefinitiva" IS NOT NULL THEN 1 END) as con_evaluacion
FROM "CausaRiesgo";

-- Ver ejemplos de controles
SELECT 
    id,
    LEFT(descripcion, 50) as descripcion,
    "puntajeTotal",
    "evaluacionDefinitiva",
    "controlTipo",
    aplicabilidad,
    cobertura
FROM "CausaRiesgo"
WHERE "puntajeTotal" IS NOT NULL
LIMIT 10;
```

**Verificar**:
- ✅ La tabla `CausaRiesgo` tiene columnas como `puntajeTotal`, `evaluacionDefinitiva`, etc.
- ✅ Hay causas con `puntajeTotal` no nulo
- ✅ Los datos se ven correctos

---

## 🔄 Paso 4: Migrar Controles a la Base de Datos Actual

1. **Conectarse a la base de datos ACTUAL**: `riesgos_db`
2. Ejecutar el script: `migrar_controles_desde_backup_completo.sql`

Este script:
- Crea la extensión `dblink` (para conectar a otra BD)
- Se conecta a `temp_backup_pre_migracion`
- Extrae los controles
- Los inserta en `ControlRiesgo` de `riesgos_db`

**Ejecutar paso por paso** (recomendado):

### 4.1. Crear extensión dblink
```sql
CREATE EXTENSION IF NOT EXISTS dblink;
```

### 4.2. Conectar a la base temporal
```sql
SELECT dblink_connect('backup_conn', 'dbname=temp_backup_pre_migracion');
```

**Resultado esperado**: `dblink_connect: OK`

### 4.3. Verificar conexión (ver cuántos controles hay)
```sql
SELECT * FROM dblink('backup_conn',
    'SELECT 
        COUNT(*) as total_causas,
        COUNT(CASE WHEN "puntajeTotal" IS NOT NULL THEN 1 END) as con_control
    FROM "CausaRiesgo"'
) AS t(total_causas bigint, con_control bigint);
```

**Resultado esperado**: Debe mostrar el número de causas y controles

### 4.4. Ver ejemplos de controles a migrar
```sql
SELECT * FROM dblink('backup_conn',
    'SELECT 
        id,
        LEFT(descripcion, 50) as descripcion,
        "puntajeTotal",
        "evaluacionDefinitiva",
        "controlTipo"
    FROM "CausaRiesgo"
    WHERE "puntajeTotal" IS NOT NULL
    LIMIT 5'
) AS t(
    id integer,
    descripcion text,
    puntaje_total integer,
    evaluacion_definitiva text,
    control_tipo text
);
```

### 4.5. Insertar controles (PASO CRÍTICO)
```sql
INSERT INTO "ControlRiesgo" (
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    responsable,
    "descripcionControl",
    aplicabilidad,
    cobertura,
    "facilidadUso",
    segregacion,
    naturaleza,
    desviaciones,
    "puntajeControl",
    "evaluacionPreliminar",
    "evaluacionDefinitiva",
    "estandarizacionPorcentajeMitigacion",
    "tipoMitigacion",
    recomendacion,
    "disminuyeFrecuenciaImpactoAmbas"
)
SELECT 
    backup_causa.id as "causaRiesgoId",
    COALESCE(backup_causa."controlDescripcion", backup_causa.descripcion, 'Control migrado') as descripcion,
    COALESCE(backup_causa."controlTipo", 'prevención') as "tipoControl",
    COALESCE(backup_causa."controlResponsable", 'Sin asignar') as responsable,
    COALESCE(backup_causa."controlDescripcion", backup_causa.descripcion, 'Control migrado desde backup') as "descripcionControl",
    COALESCE(backup_causa.aplicabilidad, 3) as aplicabilidad,
    COALESCE(backup_causa.cobertura, 3) as cobertura,
    COALESCE(backup_causa."facilidadUso", 3) as "facilidadUso",
    COALESCE(backup_causa.segregacion, 3) as segregacion,
    COALESCE(backup_causa.naturaleza, 1) as naturaleza,
    COALESCE(backup_causa.desviaciones, 0) as desviaciones,
    COALESCE(backup_causa."puntajeTotal", 75) as "puntajeControl",
    COALESCE(backup_causa."evaluacionPreliminar", 'Efectivo') as "evaluacionPreliminar",
    COALESCE(backup_causa."evaluacionDefinitiva", 'Efectivo') as "evaluacionDefinitiva",
    COALESCE(backup_causa."porcentajeMitigacion", 0) as "estandarizacionPorcentajeMitigacion",
    COALESCE(backup_causa."tipoMitigacion", 'AMBAS') as "tipoMitigacion",
    backup_causa.recomendacion as recomendacion,
    backup_causa."disminuyeFrecuenciaImpactoAmbas" as "disminuyeFrecuenciaImpactoAmbas"
FROM dblink('backup_conn',
    'SELECT 
        id,
        descripcion,
        "controlDescripcion",
        "controlTipo",
        "controlResponsable",
        aplicabilidad,
        cobertura,
        "facilidadUso",
        segregacion,
        naturaleza,
        desviaciones,
        "puntajeTotal",
        "evaluacionPreliminar",
        "evaluacionDefinitiva",
        "porcentajeMitigacion",
        "tipoMitigacion",
        recomendacion,
        "disminuyeFrecuenciaImpactoAmbas"
    FROM "CausaRiesgo"
    WHERE "puntajeTotal" IS NOT NULL'
) AS backup_causa(
    id integer,
    descripcion text,
    "controlDescripcion" text,
    "controlTipo" text,
    "controlResponsable" text,
    aplicabilidad integer,
    cobertura integer,
    "facilidadUso" integer,
    segregacion integer,
    naturaleza integer,
    desviaciones integer,
    "puntajeTotal" integer,
    "evaluacionPreliminar" text,
    "evaluacionDefinitiva" text,
    "porcentajeMitigacion" integer,
    "tipoMitigacion" text,
    recomendacion text,
    "disminuyeFrecuenciaImpactoAmbas" text
)
WHERE EXISTS (
    SELECT 1 FROM "CausaRiesgo" cr
    WHERE cr.id = backup_causa.id
)
AND NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" ctrl
    WHERE ctrl."causaRiesgoId" = backup_causa.id
);
```

**Resultado esperado**: `INSERT 0 X` (donde X es el número de controles migrados)

### 4.6. Cerrar conexión
```sql
SELECT dblink_disconnect('backup_conn');
```

### 4.7. Verificar controles migrados
```sql
-- Contar controles
SELECT COUNT(*) as total_controles FROM "ControlRiesgo";

-- Ver ejemplos
SELECT 
    id,
    "causaRiesgoId",
    LEFT(descripcion, 50) as descripcion,
    "tipoControl",
    "puntajeControl",
    "evaluacionDefinitiva"
FROM "ControlRiesgo"
ORDER BY id
LIMIT 10;

-- Estadísticas por tipo
SELECT 
    "tipoControl",
    COUNT(*) as total,
    ROUND(AVG("puntajeControl"), 2) as puntaje_promedio,
    "evaluacionDefinitiva"
FROM "ControlRiesgo"
GROUP BY "tipoControl", "evaluacionDefinitiva"
ORDER BY "tipoControl";
```

---

## ✅ Paso 5: Verificar en la Interfaz

1. **Refrescar token**: Cerrar sesión y volver a entrar
2. **Recargar página**: F5 en "Controles y Planes de Acción"
3. **Ir a pestaña "CONTROLES"**
4. **Verificar que aparecen los controles**

---

## 🧹 Paso 6: Eliminar Base de Datos Temporal (Opcional)

Una vez verificado que todo funciona:

1. En pgAdmin, clic derecho en **temp_backup_pre_migracion**
2. Seleccionar **Delete/Drop**
3. Confirmar

---

## 🔍 Solución de Problemas

### Error: "extension dblink does not exist"
**Solución**: Ejecutar como superusuario:
```sql
CREATE EXTENSION dblink;
```

### Error: "could not establish connection"
**Solución**: Verificar que la base temporal existe:
```sql
SELECT datname FROM pg_database WHERE datname = 'temp_backup_pre_migracion';
```

### No se migran controles (INSERT 0 0)
**Causa**: Los IDs de las causas no coinciden entre el backup y la BD actual

**Solución**: Verificar IDs:
```sql
-- En temp_backup_pre_migracion
SELECT id, LEFT(descripcion, 50) FROM "CausaRiesgo" WHERE "puntajeTotal" IS NOT NULL LIMIT 5;

-- En riesgos_db
SELECT id, LEFT(descripcion, 50) FROM "CausaRiesgo" LIMIT 5;
```

---

## ✅ Checklist

- [ ] Crear base de datos `temp_backup_pre_migracion`
- [ ] Restaurar backup en la base temporal
- [ ] Verificar que hay controles en el backup
- [ ] Conectarse a `riesgos_db`
- [ ] Crear extensión `dblink`
- [ ] Conectar a la base temporal
- [ ] Verificar conexión
- [ ] Insertar controles
- [ ] Verificar que se insertaron: `SELECT COUNT(*) FROM "ControlRiesgo";`
- [ ] Cerrar sesión y volver a entrar (refrescar token)
- [ ] Recargar página y verificar pestaña "CONTROLES"
- [ ] Eliminar base temporal (opcional)

---

**Fecha**: 2026-03-23  
**Estado**: ✅ LISTO PARA EJECUTAR EN PGADMIN
