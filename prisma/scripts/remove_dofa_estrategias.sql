-- =============================================================================
-- Script: Eliminar registros de estrategias DOFA (FO, FA, DO, DA)
-- Deja solo las 4 dimensiones: Fortalezas, Oportunidades, Debilidades, Amenazas.
-- Uso: psql "postgresql://user:pass@host:5432/riesgos_db" -f remove_dofa_estrategias.sql
-- =============================================================================

DELETE FROM "DofaItem"
WHERE "tipo" IN ('FO', 'FA', 'DO', 'DA');
