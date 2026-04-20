-- Corrige texto corrupto en Proceso id=11 (U+FFFD y '?' en lugar de 'é').
-- Ejecutar contra la misma BD que usa DATABASE_URL, por ejemplo:
--   psql "$DATABASE_URL" -f scripts/fix-utf8-proceso-11-estrategica.sql
-- o desde Azure Data Studio / DBeaver.

UPDATE "Proceso"
SET
  nombre = 'Gestión Estratégica',
  descripcion = 'Gestión del direccionamiento estratégico',
  objetivo = 'Definir y dirigir la estrategia organizacional.',
  "updatedAt" = NOW()
WHERE id = 11;

-- Si usan Redis para caché de GET /procesos, invalidar clave o esperar TTL (~5 min).
