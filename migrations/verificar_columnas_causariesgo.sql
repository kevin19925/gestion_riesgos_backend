-- Verificar qué columnas existen en CausaRiesgo
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'CausaRiesgo'
ORDER BY ordinal_position;
