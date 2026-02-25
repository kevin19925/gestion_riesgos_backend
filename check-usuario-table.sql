-- Script para verificar la estructura de la tabla Usuario
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'Usuario'
ORDER BY 
    ordinal_position;
