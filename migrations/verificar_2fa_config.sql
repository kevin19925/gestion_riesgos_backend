-- Verificar que la tabla ConfiguracionSistema existe y tiene los datos de 2FA

-- 1. Verificar que la tabla existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'ConfiguracionSistema'
) AS tabla_existe;

-- 2. Ver todos los registros de configuración 2FA
SELECT * FROM "ConfiguracionSistema" WHERE clave LIKE '2fa_%' ORDER BY clave;

-- 3. Contar cuántos registros hay
SELECT COUNT(*) as total_registros_2fa FROM "ConfiguracionSistema" WHERE clave LIKE '2fa_%';

-- 4. Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ConfiguracionSistema'
ORDER BY ordinal_position;
