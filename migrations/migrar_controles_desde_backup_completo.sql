-- Migración de Controles desde Backup Pre-Migración
-- Este script extrae los controles del backup y los inserta en la tabla ControlRiesgo actual

-- IMPORTANTE: Antes de ejecutar este script, debes haber ejecutado:
-- restaurar_backup_completo.ps1
-- Esto crea la base de datos temporal: temp_backup_pre_migracion

-- PASO 1: Verificar que la base de datos temporal existe
-- (Ejecutar en pgAdmin conectado a postgres)
SELECT datname FROM pg_database WHERE datname = 'temp_backup_pre_migracion';
-- Debe mostrar 1 fila

-- PASO 2: Conectarse a la base de datos ACTUAL (riesgos_db)
-- y ejecutar el resto de este script

-- PASO 3: Crear extensión dblink si no existe (para conectar a otra BD)
CREATE EXTENSION IF NOT EXISTS dblink;

-- PASO 4: Verificar conexión a la base de datos temporal
SELECT dblink_connect('backup_conn', 'dbname=temp_backup_pre_migracion');

-- PASO 5: Ver cuántos controles hay en el backup
SELECT * FROM dblink('backup_conn',
    'SELECT 
        COUNT(*) as total_causas,
        COUNT(CASE WHEN "puntajeTotal" IS NOT NULL THEN 1 END) as con_control
    FROM "CausaRiesgo"'
) AS t(total_causas bigint, con_control bigint);

-- PASO 6: Ver ejemplos de controles en el backup
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

-- PASO 7: Insertar controles desde el backup a la tabla actual
-- IMPORTANTE: Esto insertará SOLO las causas que existen en ambas bases de datos
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
-- Solo insertar si la causa existe en la base de datos actual
WHERE EXISTS (
    SELECT 1 FROM "CausaRiesgo" cr
    WHERE cr.id = backup_causa.id
)
-- Y no existe ya un control para esa causa
AND NOT EXISTS (
    SELECT 1 FROM "ControlRiesgo" ctrl
    WHERE ctrl."causaRiesgoId" = backup_causa.id
);

-- PASO 8: Cerrar conexión
SELECT dblink_disconnect('backup_conn');

-- PASO 9: Verificar resultados
SELECT 
    'Controles migrados' as descripcion,
    COUNT(*) as total
FROM "ControlRiesgo";

-- PASO 10: Ver ejemplos de controles migrados
SELECT 
    ctrl.id,
    ctrl."causaRiesgoId",
    LEFT(ctrl.descripcion, 50) as descripcion,
    ctrl."tipoControl",
    ctrl."puntajeControl",
    ctrl."evaluacionDefinitiva"
FROM "ControlRiesgo" ctrl
ORDER BY ctrl.id
LIMIT 10;

-- PASO 11: Ver estadísticas por tipo de control
SELECT 
    "tipoControl",
    COUNT(*) as total,
    AVG("puntajeControl") as puntaje_promedio,
    "evaluacionDefinitiva"
FROM "ControlRiesgo"
GROUP BY "tipoControl", "evaluacionDefinitiva"
ORDER BY "tipoControl", "evaluacionDefinitiva";

-- PASO 12 (OPCIONAL): Eliminar la base de datos temporal
-- Ejecutar en terminal:
-- dropdb -h localhost -U postgres temp_backup_pre_migracion
