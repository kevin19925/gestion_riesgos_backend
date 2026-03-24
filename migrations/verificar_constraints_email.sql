-- Verificar si hay constraints en la columna email de la tabla Usuario
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = '"Usuario"'::regclass
  AND contype = 'c'  -- CHECK constraints
  AND pg_get_constraintdef(oid) LIKE '%email%';

-- Ver todos los constraints de la tabla Usuario
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = '"Usuario"'::regclass;
