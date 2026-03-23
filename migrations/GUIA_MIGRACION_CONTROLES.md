# Guía para Migrar Controles desde Backup

## Situación Actual

Los controles estaban almacenados como **columnas** en la tabla `CausaRiesgo` antes de la normalización. Ahora necesitamos migrarlos a la tabla `ControlRiesgo`.

## Campos Identificados en el Backup

En `temp_backup_pre_migracion`, la tabla `CausaRiesgo` tiene estos campos para controles:

- `tipoGestion`: 'CONTROL' o 'AMBOS'
- `controlDescripcion`: Descripción del control
- `aplicabilidad`: 'totalmente', 'parcialmente', etc.
- `cobertura`: 'total', 'parcial'
- `facilidadUso`: 'coherente', 'medianamente'
- `segregacion`: 'si', 'no'
- `naturaleza`: 'automatico', 'semiautomatico', 'manual'
- `desviaciones`: 'A', 'B', 'C', 'D'
- `puntajeTotal`: Puntaje numérico del control
- `evaluacionPreliminar`: Evaluación preliminar
- `evaluacionDefinitiva`: 'Efectivo', 'Parcialmente Efectivo', etc.
- `tipoMitigacion`: 'AMBAS', 'FRECUENCIA', 'IMPACTO'
- `porcentajeMitigacion`: Porcentaje decimal (0.61 = 61%)
- `responsable`: Responsable del control
- `recomendacion`: Recomendaciones
- `recalculadoEn`: Fecha de recálculo

## Opción 1: Migración Directa (Requiere dblink)

Ejecutar el script `migrar_controles_desde_backup.sql` en la base de datos actual.

**Prerequisito:** Instalar extensión dblink
```sql
CREATE EXTENSION IF NOT EXISTS dblink;
```

## Opción 2: Migración Manual (Recomendada)

### Paso 1: Exportar Controles desde Backup

Conectarse a `temp_backup_pre_migracion` y ejecutar:

```sql
COPY (
    SELECT 
        id as causa_id,
        "riesgoId",
        descripcion as causa_descripcion,
        "controlDescripcion",
        responsable,
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
        "descripcionControl",
        recomendacion,
        "tipoGestion",
        "recalculadoEn"
    FROM "CausaRiesgo"
    WHERE "tipoGestion" IN ('CONTROL', 'AMBOS')
    AND "controlDescripcion" IS NOT NULL
    ORDER BY id
) TO 'C:/temp/controles_backup.csv' WITH CSV HEADER;
```

### Paso 2: Crear Tabla Temporal en Base Actual

Conectarse a `riesgosdb` (base actual) y ejecutar:

```sql
CREATE TEMP TABLE temp_controles_backup (
    causa_id integer,
    riesgo_id integer,
    causa_descripcion text,
    control_descripcion text,
    responsable text,
    aplicabilidad text,
    cobertura text,
    facilidad_uso text,
    segregacion text,
    naturaleza text,
    desviaciones text,
    puntaje_total integer,
    evaluacion_preliminar text,
    evaluacion_definitiva text,
    porcentaje_mitigacion numeric,
    tipo_mitigacion text,
    descripcion_control text,
    recomendacion text,
    tipo_gestion text,
    recalculado_en timestamp
);
```

### Paso 3: Importar CSV a Tabla Temporal

```sql
COPY temp_controles_backup 
FROM 'C:/temp/controles_backup.csv' 
WITH CSV HEADER;
```

### Paso 4: Verificar Importación

```sql
SELECT COUNT(*) as total_importados FROM temp_controles_backup;

SELECT * FROM temp_controles_backup LIMIT 5;
```

### Paso 5: Migrar a ControlRiesgo

```sql
INSERT INTO "ControlRiesgo" (
    "causaRiesgoId",
    descripcion,
    "tipoControl",
    responsable,
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
    "disminuyeFrecuenciaImpactoAmbas",
    "descripcionControl",
    recomendacion,
    "tipoMitigacion",
    "estadoAmbos",
    "recalculadoEn"
)
SELECT 
    temp.causa_id as "causaRiesgoId",
    temp.control_descripcion as descripcion,
    'PREVENTIVO' as "tipoControl",
    temp.responsable,
    CASE 
        WHEN temp.aplicabilidad = 'totalmente' THEN 100
        WHEN temp.aplicabilidad = 'parcialmente' THEN 50
        ELSE 0
    END as aplicabilidad,
    CASE 
        WHEN temp.cobertura = 'total' THEN 100
        WHEN temp.cobertura = 'parcial' THEN 50
        ELSE 0
    END as cobertura,
    CASE 
        WHEN temp.facilidad_uso = 'coherente' THEN 100
        WHEN temp.facilidad_uso = 'medianamente' THEN 50
        ELSE 0
    END as "facilidadUso",
    CASE 
        WHEN temp.segregacion = 'si' THEN 100
        WHEN temp.segregacion = 'no' THEN 0
        ELSE 0
    END as segregacion,
    CASE 
        WHEN temp.naturaleza = 'automatico' THEN 100
        WHEN temp.naturaleza = 'semiautomatico' THEN 60
        WHEN temp.naturaleza = 'manual' THEN 30
        ELSE 0
    END as naturaleza,
    CASE 
        WHEN temp.desviaciones = 'A' THEN 100
        WHEN temp.desviaciones = 'B' THEN 75
        WHEN temp.desviaciones = 'C' THEN 50
        WHEN temp.desviaciones = 'D' THEN 25
        ELSE 0
    END as desviaciones,
    temp.puntaje_total as "puntajeControl",
    temp.evaluacion_preliminar,
    temp.evaluacion_definitiva,
    ROUND((temp.porcentaje_mitigacion * 100)::numeric, 0)::integer as "estandarizacionPorcentajeMitigacion",
    temp.tipo_mitigacion as "disminuyeFrecuenciaImpactoAmbas",
    temp.descripcion_control,
    temp.recomendacion,
    temp.tipo_mitigacion,
    CASE 
        WHEN temp.tipo_gestion = 'AMBOS' THEN 'ACTIVO'
        ELSE NULL
    END as "estadoAmbos",
    temp.recalculado_en
FROM temp_controles_backup temp
INNER JOIN "CausaRiesgo" causa ON causa.id = temp.causa_id
WHERE NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" 
    WHERE "causaRiesgoId" = temp.causa_id
);
```

### Paso 6: Verificar Migración

```sql
-- Contar controles migrados
SELECT COUNT(*) as controles_migrados FROM "ControlRiesgo";

-- Ver ejemplos
SELECT 
    cr.id,
    cr."causaRiesgoId",
    cr.descripcion,
    cr."puntajeControl",
    cr."evaluacionDefinitiva",
    causa.descripcion as causa_descripcion
FROM "ControlRiesgo" cr
INNER JOIN "CausaRiesgo" causa ON causa.id = cr."causaRiesgoId"
LIMIT 10;

-- Verificar por riesgo
SELECT 
    r.id as riesgo_id,
    r."numeroIdentificacion",
    r.descripcion as riesgo,
    COUNT(DISTINCT cr.id) as num_controles
FROM "Riesgo" r
INNER JOIN "CausaRiesgo" causa ON causa."riesgoId" = r.id
LEFT JOIN "ControlRiesgo" cr ON cr."causaRiesgoId" = causa.id
GROUP BY r.id, r."numeroIdentificacion", r.descripcion
HAVING COUNT(DISTINCT cr.id) > 0
ORDER BY num_controles DESC
LIMIT 10;
```

## Notas Importantes

1. **Mapeo de Valores**: Los valores textuales se convierten a numéricos según la lógica del sistema
2. **tipoControl**: Se asigna 'PREVENTIVO' por defecto, ajustar si es necesario
3. **estadoAmbos**: Solo se marca para causas con `tipoGestion = 'AMBOS'`
4. **Duplicados**: El script verifica que no existan controles duplicados antes de insertar

## Troubleshooting

### Error: "permission denied for COPY"
Usar una ruta donde tengas permisos de escritura, por ejemplo:
- Windows: `C:/Users/TuUsuario/Desktop/controles_backup.csv`
- Alternativa: Exportar desde pgAdmin usando "Export" en el menú contextual

### Error: "relation does not exist"
Verificar que estás conectado a la base de datos correcta antes de ejecutar cada paso.
