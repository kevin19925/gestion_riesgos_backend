-- =====================================================
-- MIGRACIÓN: Crear tablas para Asistentes y Reuniones
-- Fecha: 2024
-- Descripción: Tablas para gestionar asistentes de procesos,
--              reuniones programadas y registro de asistencia
-- =====================================================

-- Tabla: AsistentesProceso
-- Almacena los usuarios asignados como asistentes de un proceso
CREATE TABLE IF NOT EXISTS "AsistentesProceso" (
    "id" SERIAL PRIMARY KEY,
    "procesoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "rol" VARCHAR(50) NOT NULL, -- 'dueño_procesos' o 'supervisor_riesgos'
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT "AsistentesProceso_procesoId_fkey" 
        FOREIGN KEY ("procesoId") 
        REFERENCES "Proceso"("id") 
        ON DELETE CASCADE,
    
    CONSTRAINT "AsistentesProceso_usuarioId_fkey" 
        FOREIGN KEY ("usuarioId") 
        REFERENCES "Usuario"("id") 
        ON DELETE CASCADE,
    
    -- Constraint único: un usuario no puede ser asistente duplicado del mismo proceso
    CONSTRAINT "AsistentesProceso_procesoId_usuarioId_key" 
        UNIQUE ("procesoId", "usuarioId")
);

-- Índices para AsistentesProceso
CREATE INDEX IF NOT EXISTS "AsistentesProceso_procesoId_idx" ON "AsistentesProceso"("procesoId");
CREATE INDEX IF NOT EXISTS "AsistentesProceso_usuarioId_idx" ON "AsistentesProceso"("usuarioId");

-- Tabla: ReunionProceso
-- Almacena las reuniones programadas para un proceso
CREATE TABLE IF NOT EXISTS "ReunionProceso" (
    "id" SERIAL PRIMARY KEY,
    "procesoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(6) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'programada', -- 'programada', 'realizada', 'cancelada'
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    CONSTRAINT "ReunionProceso_procesoId_fkey" 
        FOREIGN KEY ("procesoId") 
        REFERENCES "Proceso"("id") 
        ON DELETE CASCADE
);

-- Índices para ReunionProceso
CREATE INDEX IF NOT EXISTS "ReunionProceso_procesoId_idx" ON "ReunionProceso"("procesoId");
CREATE INDEX IF NOT EXISTS "ReunionProceso_fecha_idx" ON "ReunionProceso"("fecha");
CREATE INDEX IF NOT EXISTS "ReunionProceso_estado_idx" ON "ReunionProceso"("estado");

-- Tabla: AsistenciaReunion
-- Registra la asistencia de cada usuario a cada reunión
CREATE TABLE IF NOT EXISTS "AsistenciaReunion" (
    "id" SERIAL PRIMARY KEY,
    "reunionId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "asistio" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "registradoEn" TIMESTAMP(6),
    
    -- Foreign keys
    CONSTRAINT "AsistenciaReunion_reunionId_fkey" 
        FOREIGN KEY ("reunionId") 
        REFERENCES "ReunionProceso"("id") 
        ON DELETE CASCADE,
    
    CONSTRAINT "AsistenciaReunion_usuarioId_fkey" 
        FOREIGN KEY ("usuarioId") 
        REFERENCES "Usuario"("id") 
        ON DELETE CASCADE,
    
    -- Constraint único: un usuario solo puede tener un registro de asistencia por reunión
    CONSTRAINT "AsistenciaReunion_reunionId_usuarioId_key" 
        UNIQUE ("reunionId", "usuarioId")
);

-- Índices para AsistenciaReunion
CREATE INDEX IF NOT EXISTS "AsistenciaReunion_reunionId_idx" ON "AsistenciaReunion"("reunionId");
CREATE INDEX IF NOT EXISTS "AsistenciaReunion_usuarioId_idx" ON "AsistenciaReunion"("usuarioId");

-- =====================================================
-- COMENTARIOS EN LAS TABLAS
-- =====================================================

COMMENT ON TABLE "AsistentesProceso" IS 'Usuarios asignados como asistentes de un proceso (Dueños de Procesos y Supervisores de Riesgos)';
COMMENT ON TABLE "ReunionProceso" IS 'Reuniones programadas para seguimiento de procesos';
COMMENT ON TABLE "AsistenciaReunion" IS 'Registro de asistencia de usuarios a reuniones';

COMMENT ON COLUMN "AsistentesProceso"."rol" IS 'Rol del asistente: dueño_procesos o supervisor_riesgos';
COMMENT ON COLUMN "ReunionProceso"."estado" IS 'Estado de la reunión: programada, realizada o cancelada';
COMMENT ON COLUMN "AsistenciaReunion"."asistio" IS 'Indica si el usuario asistió a la reunión';
COMMENT ON COLUMN "AsistenciaReunion"."registradoEn" IS 'Fecha y hora en que se registró la asistencia';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    tablename, 
    schemaname 
FROM pg_tables 
WHERE tablename IN ('AsistentesProceso', 'ReunionProceso', 'AsistenciaReunion')
ORDER BY tablename;

-- Verificar constraints
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid::regclass::text IN ('AsistentesProceso', 'ReunionProceso', 'AsistenciaReunion')
ORDER BY table_name, constraint_name;
