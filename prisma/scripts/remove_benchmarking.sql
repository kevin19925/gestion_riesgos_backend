-- =============================================================================
-- Script: Eliminar módulo Benchmarking de la base de datos
-- Ejecutar contra la BD cuando se quiera quitar la tabla sin usar Prisma.
-- Uso: psql "postgresql://user:pass@host:5432/riesgos_db" -f remove_benchmarking.sql
--      o desde pgAdmin/DBeaver ejecutar este archivo.
-- =============================================================================

-- Eliminar tabla Benchmarking (relación con Proceso se elimina por CASCADE)
DROP TABLE IF EXISTS "Benchmarking" CASCADE;
