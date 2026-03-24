-- Insertar configuración por defecto de 2FA
-- Este script inserta los valores de configuración necesarios para el sistema 2FA

-- Verificar si ya existen los registros
DO $$
BEGIN
  -- Insertar configuración de 2FA habilitado global (por defecto: false)
  IF NOT EXISTS (SELECT 1 FROM "ConfiguracionSistema" WHERE clave = '2fa_habilitado_global') THEN
    INSERT INTO "ConfiguracionSistema" (clave, valor, descripcion, "updatedAt")
    VALUES ('2fa_habilitado_global', 'false', 'Habilitar 2FA para todos los usuarios', NOW());
  END IF;

  -- Insertar configuración de 2FA obligatorio (por defecto: false)
  IF NOT EXISTS (SELECT 1 FROM "ConfiguracionSistema" WHERE clave = '2fa_obligatorio') THEN
    INSERT INTO "ConfiguracionSistema" (clave, valor, descripcion, "updatedAt")
    VALUES ('2fa_obligatorio', 'false', 'Hacer 2FA obligatorio para todos los usuarios', NOW());
  END IF;

  -- Insertar configuración de ventana de tiempo (por defecto: 30 segundos)
  IF NOT EXISTS (SELECT 1 FROM "ConfiguracionSistema" WHERE clave = '2fa_ventana_tiempo') THEN
    INSERT INTO "ConfiguracionSistema" (clave, valor, descripcion, "updatedAt")
    VALUES ('2fa_ventana_tiempo', '30', 'Ventana de tiempo en segundos para validar códigos TOTP', NOW());
  END IF;

  -- Insertar configuración de máximo de intentos (por defecto: 5)
  IF NOT EXISTS (SELECT 1 FROM "ConfiguracionSistema" WHERE clave = '2fa_max_intentos') THEN
    INSERT INTO "ConfiguracionSistema" (clave, valor, descripcion, "updatedAt")
    VALUES ('2fa_max_intentos', '5', 'Máximo de intentos fallidos de verificación 2FA', NOW());
  END IF;

  -- Insertar configuración de días de dispositivos confiables (por defecto: 30)
  IF NOT EXISTS (SELECT 1 FROM "ConfiguracionSistema" WHERE clave = '2fa_dispositivos_confiables_dias') THEN
    INSERT INTO "ConfiguracionSistema" (clave, valor, descripcion, "updatedAt")
    VALUES ('2fa_dispositivos_confiables_dias', '30', 'Días de validez de dispositivos confiables', NOW());
  END IF;
END $$;

-- Verificar que se insertaron correctamente
SELECT * FROM "ConfiguracionSistema" WHERE clave LIKE '2fa_%' ORDER BY clave;
