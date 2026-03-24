-- Script de Verificación: Migración 2FA
-- Ejecutar DESPUÉS de add_2fa_support.sql para verificar que todo esté correcto

-- ============================================
-- 1. Verificar columnas en Usuario
-- ============================================

SELECT 
  'Usuario - Columnas 2FA' as verificacion,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'Usuario'
  AND column_name IN ('twoFactorEnabled', 'twoFactorSecret', 'recoveryCodes', 'twoFactorBackupUsed')
ORDER BY column_name;

-- ============================================
-- 2. Verificar tabla ConfiguracionSistema
-- ============================================

SELECT 
  'ConfiguracionSistema - Estructura' as verificacion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'ConfiguracionSistema'
ORDER BY ordinal_position;

-- Verificar configuraciones insertadas
SELECT 
  'ConfiguracionSistema - Datos' as verificacion,
  clave,
  valor,
  descripcion,
  tipo
FROM "ConfiguracionSistema"
WHERE clave LIKE '2fa_%'
ORDER BY clave;

-- ============================================
-- 3. Verificar tabla DispositivosConfiables
-- ============================================

SELECT 
  'DispositivosConfiables - Estructura' as verificacion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'DispositivosConfiables'
ORDER BY ordinal_position;

-- Verificar índices
SELECT 
  'DispositivosConfiables - Índices' as verificacion,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'DispositivosConfiables'
ORDER BY indexname;

-- ============================================
-- 4. Verificar tabla AuditoriaAutenticacion
-- ============================================

SELECT 
  'AuditoriaAutenticacion - Estructura' as verificacion,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'AuditoriaAutenticacion'
ORDER BY ordinal_position;

-- Verificar índices
SELECT 
  'AuditoriaAutenticacion - Índices' as verificacion,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'AuditoriaAutenticacion'
ORDER BY indexname;

-- ============================================
-- 5. Verificar función de limpieza
-- ============================================

SELECT 
  'Funciones - limpiar_dispositivos_expirados' as verificacion,
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'limpiar_dispositivos_expirados';

-- ============================================
-- 6. Resumen de verificación
-- ============================================

DO $$
DECLARE
  columnas_usuario INTEGER;
  config_count INTEGER;
  dispositivos_table BOOLEAN;
  auditoria_table BOOLEAN;
  funcion_limpieza BOOLEAN;
BEGIN
  -- Contar columnas 2FA en Usuario
  SELECT COUNT(*) INTO columnas_usuario
  FROM information_schema.columns
  WHERE table_name = 'Usuario'
    AND column_name IN ('twoFactorEnabled', 'twoFactorSecret', 'recoveryCodes', 'twoFactorBackupUsed');

  -- Contar configuraciones 2FA
  SELECT COUNT(*) INTO config_count
  FROM "ConfiguracionSistema"
  WHERE clave LIKE '2fa_%';

  -- Verificar tablas
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'DispositivosConfiables'
  ) INTO dispositivos_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'AuditoriaAutenticacion'
  ) INTO auditoria_table;

  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_name = 'limpiar_dispositivos_expirados'
  ) INTO funcion_limpieza;

  -- Mostrar resumen
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN DE VERIFICACIÓN 2FA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Columnas en Usuario: % de 4', columnas_usuario;
  RAISE NOTICE 'Configuraciones 2FA: % de 5', config_count;
  RAISE NOTICE 'Tabla DispositivosConfiables: %', CASE WHEN dispositivos_table THEN '✓' ELSE '✗' END;
  RAISE NOTICE 'Tabla AuditoriaAutenticacion: %', CASE WHEN auditoria_table THEN '✓' ELSE '✗' END;
  RAISE NOTICE 'Función limpieza: %', CASE WHEN funcion_limpieza THEN '✓' ELSE '✗' END;
  RAISE NOTICE '========================================';

  IF columnas_usuario = 4 AND config_count >= 5 AND dispositivos_table AND auditoria_table AND funcion_limpieza THEN
    RAISE NOTICE '✓ MIGRACIÓN 2FA COMPLETADA EXITOSAMENTE';
  ELSE
    RAISE WARNING '✗ MIGRACIÓN INCOMPLETA - Revisar detalles arriba';
  END IF;
END $$;
