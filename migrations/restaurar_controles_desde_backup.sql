-- Script para Restaurar Controles desde Backup
-- Este script debe ejecutarse DESPUÉS de restaurar el backup a una base de datos temporal

-- PASO 1: Restaurar el backup a una base de datos temporal
-- Ejecutar en la terminal (NO en pgAdmin):
-- createdb -h localhost -U postgres temp_backup_db
-- pg_restore -h localhost -U postgres -d temp_backup_db gestion_riesgos_backend/migrations/backup_Control

-- PASO 2: Conectarse a la base de datos temporal y verificar estructura
-- Ejecutar en pgAdmin conectado a temp_backup_db:

-- Ver qué tablas tiene el backup
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Ver estructura de CausaRiesgo en el backup
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;

-- Ver si existe tabla ControlRiesgo en el backup
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ControlRiesgo'
ORDER BY ordinal_position;

-- Ver ejemplos de causas con datos de control
SELECT 
    id,
    descripcion,
    "puntajeTotal",
    "evaluacionDefinitiva",
    "controlDescripcion",
    "controlTipo",
    aplicabilidad,
    cobertura,
    "facilidadUso",
    segregacion,
    naturaleza
FROM "CausaRiesgo"
WHERE "puntajeTotal" IS NOT NULL
LIMIT 10;

-- PASO 3: Una vez verificado, ejecutar el siguiente script
-- para copiar los datos del backup a la base de datos actual
