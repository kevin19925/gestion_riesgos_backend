-- Migración manual: Crear tabla AuditLog
-- Fecha: 2026-03-05
-- Descripción: Tabla para sistema de auditoría

-- 1. Hacer la columna role nullable (no elimina datos)
ALTER TABLE "Usuario" ALTER COLUMN "role" DROP NOT NULL;

-- 2. Crear tabla AuditLog
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioEmail" TEXT NOT NULL,
    "usuarioRole" TEXT NOT NULL,
    "accion" VARCHAR(20) NOT NULL,
    "tabla" VARCHAR(100) NOT NULL,
    "registroId" INTEGER,
    "registroDesc" TEXT,
    "cambios" JSONB,
    "datosAnteriores" JSONB,
    "datosNuevos" JSONB,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- 3. Crear índices para performance
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");
CREATE INDEX "AuditLog_tabla_idx" ON "AuditLog"("tabla");
CREATE INDEX "AuditLog_accion_idx" ON "AuditLog"("accion");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_tabla_accion_idx" ON "AuditLog"("tabla", "accion");
CREATE INDEX "AuditLog_createdAt_tabla_idx" ON "AuditLog"("createdAt", "tabla");

-- Verificación
SELECT 'Tabla AuditLog creada exitosamente' as resultado;
