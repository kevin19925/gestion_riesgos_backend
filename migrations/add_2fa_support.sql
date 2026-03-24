-- Migración: Agregar soporte para Autenticación de Dos Factores (2FA)
-- Fecha: 2026-03-24
-- Descripción: Agrega campos necesarios para 2FA en Usuario, crea tabla de configuración y dispositivos confiables

-- ============================================
-- 1. Modificar tabla Usuario para 2FA
-- ============================================

-- Agregar columnas para 2FA en la tabla Usuario
ALTER TABLE "Usuario" 
ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT,
ADD COLUMN IF NOT EXISTS "recoveryCodes" TEXT[],
ADD COLUMN IF NOT EXISTS "twoFactorBackupUsed" INTEGER DEFAULT 0;

-- Comentarios para documentación
COMMENT ON COLUMN "Usuario"."twoFactorEnabled" IS 'Indica si el usuario tiene 2FA activado';
COMMENT ON COLUMN "Usuario"."twoFactorSecret" IS 'Secret encriptado para TOTP (Google Authenticator)';
COMMENT ON COLUMN "Usuario"."recoveryCodes" IS 'Array de códigos de respaldo hasheados';
COMMENT ON COLUMN "Usuario"."twoFactorBackupUsed" IS 'Contador de códigos de respaldo utilizados';

-- ============================================
-- 2. Crear tabla ConfiguracionSistema
-- ============================================

CREATE TABLE IF NOT EXISTS "ConfiguracionSistema" (
  "id" SERIAL PRIMARY KEY,
  "clave" TEXT UNIQUE NOT NULL,
  "valor" TEXT NOT NULL,
  "descripcion" TEXT,
  "tipo" TEXT DEFAULT 'string',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE "ConfiguracionSistema" IS 'Configuraciones globales del sistema';
COMMENT ON COLUMN "ConfiguracionSistema"."clave" IS 'Identificador único de la configuración';
COMMENT ON COLUMN "ConfiguracionSistema"."valor" IS 'Valor de la configuración (puede ser JSON)';
COMMENT ON COLUMN "ConfiguracionSistema"."tipo" IS 'Tipo de dato: string, boolean, number, json';

-- Insertar configuraciones iniciales para 2FA
INSERT INTO "ConfiguracionSistema" ("clave", "valor", "descripcion", "tipo") 
VALUES
  ('2fa_habilitado_global', 'false', 'Habilitar 2FA para todos los usuarios del sistema', 'boolean'),
  ('2fa_obligatorio', 'false', 'Hacer 2FA obligatorio para todos los usuarios (excepto admin)', 'boolean'),
  ('2fa_ventana_tiempo', '30', 'Ventana de tiempo en segundos para validar códigos TOTP', 'number'),
  ('2fa_max_intentos', '5', 'Máximo de intentos fallidos de 2FA por minuto', 'number'),
  ('2fa_dispositivos_confiables_dias', '30', 'Días de validez para dispositivos confiables', 'number')
ON CONFLICT ("clave") DO NOTHING;

-- ============================================
-- 3. Crear tabla DispositivosConfiables
-- ============================================

CREATE TABLE IF NOT EXISTS "DispositivosConfiables" (
  "id" SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
  "deviceFingerprint" TEXT NOT NULL,
  "deviceName" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "navegador" TEXT,
  "sistemaOperativo" TEXT,
  "activo" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL,
  "lastUsedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("usuarioId", "deviceFingerprint")
);

COMMENT ON TABLE "DispositivosConfiables" IS 'Dispositivos marcados como confiables para omitir 2FA temporalmente';
COMMENT ON COLUMN "DispositivosConfiables"."deviceFingerprint" IS 'Hash único del dispositivo basado en múltiples factores';
COMMENT ON COLUMN "DispositivosConfiables"."deviceName" IS 'Nombre descriptivo del dispositivo (ej: Chrome en Windows)';
COMMENT ON COLUMN "DispositivosConfiables"."activo" IS 'Permite revocar dispositivos sin eliminarlos';

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS "idx_dispositivos_usuario" ON "DispositivosConfiables"("usuarioId");
CREATE INDEX IF NOT EXISTS "idx_dispositivos_fingerprint" ON "DispositivosConfiables"("deviceFingerprint");
CREATE INDEX IF NOT EXISTS "idx_dispositivos_expiracion" ON "DispositivosConfiables"("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_dispositivos_activo" ON "DispositivosConfiables"("activo");

-- ============================================
-- 4. Crear tabla AuditoriaAutenticacion
-- ============================================

CREATE TABLE IF NOT EXISTS "AuditoriaAutenticacion" (
  "id" SERIAL PRIMARY KEY,
  "usuarioId" INTEGER REFERENCES "Usuario"("id") ON DELETE SET NULL,
  "email" TEXT NOT NULL,
  "evento" TEXT NOT NULL,
  "exitoso" BOOLEAN NOT NULL,
  "metodo" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "detalles" JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE "AuditoriaAutenticacion" IS 'Registro de eventos de autenticación y 2FA para auditoría';
COMMENT ON COLUMN "AuditoriaAutenticacion"."evento" IS 'Tipo de evento: login, 2fa_setup, 2fa_verify, 2fa_disable, recovery_code_used, etc.';
COMMENT ON COLUMN "AuditoriaAutenticacion"."metodo" IS 'Método usado: totp, recovery_code, trusted_device';

-- Índices para consultas de auditoría
CREATE INDEX IF NOT EXISTS "idx_auditoria_usuario" ON "AuditoriaAutenticacion"("usuarioId");
CREATE INDEX IF NOT EXISTS "idx_auditoria_email" ON "AuditoriaAutenticacion"("email");
CREATE INDEX IF NOT EXISTS "idx_auditoria_evento" ON "AuditoriaAutenticacion"("evento");
CREATE INDEX IF NOT EXISTS "idx_auditoria_fecha" ON "AuditoriaAutenticacion"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_auditoria_exitoso" ON "AuditoriaAutenticacion"("exitoso");

-- ============================================
-- 5. Función para limpiar dispositivos expirados
-- ============================================

CREATE OR REPLACE FUNCTION limpiar_dispositivos_expirados()
RETURNS INTEGER AS $$
DECLARE
  dispositivos_eliminados INTEGER;
BEGIN
  -- Marcar como inactivos los dispositivos expirados
  UPDATE "DispositivosConfiables"
  SET "activo" = FALSE
  WHERE "expiresAt" < NOW() AND "activo" = TRUE;
  
  GET DIAGNOSTICS dispositivos_eliminados = ROW_COUNT;
  
  RETURN dispositivos_eliminados;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION limpiar_dispositivos_expirados() IS 'Marca como inactivos los dispositivos confiables que han expirado';

-- ============================================
-- 6. Verificación de la migración
-- ============================================

-- Verificar que las columnas se agregaron correctamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Usuario' 
    AND column_name = 'twoFactorEnabled'
  ) THEN
    RAISE NOTICE '✓ Columnas 2FA agregadas a Usuario correctamente';
  ELSE
    RAISE EXCEPTION '✗ Error: Columnas 2FA no se agregaron a Usuario';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ConfiguracionSistema'
  ) THEN
    RAISE NOTICE '✓ Tabla ConfiguracionSistema creada correctamente';
  ELSE
    RAISE EXCEPTION '✗ Error: Tabla ConfiguracionSistema no fue creada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'DispositivosConfiables'
  ) THEN
    RAISE NOTICE '✓ Tabla DispositivosConfiables creada correctamente';
  ELSE
    RAISE EXCEPTION '✗ Error: Tabla DispositivosConfiables no fue creada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'AuditoriaAutenticacion'
  ) THEN
    RAISE NOTICE '✓ Tabla AuditoriaAutenticacion creada correctamente';
  ELSE
    RAISE EXCEPTION '✗ Error: Tabla AuditoriaAutenticacion no fue creada';
  END IF;

  RAISE NOTICE '✓ Migración 2FA completada exitosamente';
END $$;
