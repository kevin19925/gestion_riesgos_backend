-- Verificar que la columna responsable existe y ver los datos actuales

-- 1. Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Normatividad'
ORDER BY ordinal_position;

-- 2. Ver todas las normatividades con sus responsables
SELECT 
    id,
    "procesoId",
    numero,
    nombre,
    cumplimiento,
    responsable,
    "createdAt",
    "updatedAt"
FROM "Normatividad"
ORDER BY "updatedAt" DESC
LIMIT 10;

-- 3. Contar normatividades por cumplimiento
SELECT 
    cumplimiento,
    COUNT(*) as total,
    COUNT(responsable) as con_responsable,
    COUNT(*) - COUNT(responsable) as sin_responsable
FROM "Normatividad"
GROUP BY cumplimiento;
