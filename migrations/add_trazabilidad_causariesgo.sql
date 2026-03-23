-- =====================================================
-- MIGRACIÓN: Trazabilidad de Planes de Acción (Opción 1 - JSON)
-- Fecha: 2024-03-22
-- Descripción: Agrega trazabilidad para planes en CausaRiesgo.gestion
--              y crea tabla de alertas de vencimiento
-- =====================================================

-- IMPORTANTE: Esta migración es SEGURA y NO DESTRUCTIVA
-- - No modifica datos existentes en CausaRiesgo.gestion
-- - Solo agrega nuevas tablas y campos
-- - Los planes existentes siguen funcionando sin cambios

BEGIN;

-- =====================================================
-- PASO 1: Crear tabla AlertaVencimiento
-- =====================================================

CREATE TABLE IF NOT EXISTS "AlertaVencimiento" (
    "id" SERIAL PRIMARY KEY,
    "causaRiesgoId" INTEGER NOT NULL,  -- ← Referencia a CausaRiesgo (donde está el plan)
    "usuarioId" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,       -- "proximo" | "vencido"
    "diasRestantes" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLectura" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT "AlertaVencimiento_causaRiesgoId_fkey" 
        FOREIGN KEY ("causaRiesgoId") 
        REFERENCES "CausaRiesgo"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT "AlertaVencimiento_usuarioId_fkey" 
        FOREIGN KEY ("usuarioId") 
        REFERENCES "Usuario"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Índices para AlertaVencimiento
CREATE INDEX IF NOT EXISTS "AlertaVencimiento_causaRiesgoId_idx" 
ON "AlertaVencimiento"("causaRiesgoId");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_usuarioId_idx" 
ON "AlertaVencimiento"("usuarioId");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_leida_idx" 
ON "AlertaVencimiento"("leida");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_fechaGeneracion_idx" 
ON "AlertaVencimiento"("fechaGeneracion");

CREATE INDEX IF NOT EXISTS "AlertaVencimiento_tipo_idx" 
ON "AlertaVencimiento"("tipo");

-- =====================================================
-- PASO 2: Agregar campos de trazabilidad a Control
-- =====================================================

-- Campo para referenciar la causa de riesgo origen (si fue creado desde un plan)
ALTER TABLE "Control" 
ADD COLUMN IF NOT EXISTS "causaRiesgoOrigenId" INTEGER;

-- Fecha en que el control fue creado desde un plan
ALTER TABLE "Control" 
ADD COLUMN IF NOT EXISTS "fechaCreacionDesdePlan" TIMESTAMP(3);

-- Crear constraint de unicidad para causaRiesgoOrigenId
-- (un plan solo puede generar un control)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Control_causaRiesgoOrigenId_key'
    ) THEN
        ALTER TABLE "Control" 
        ADD CONSTRAINT "Control_causaRiesgoOrigenId_key" 
        UNIQUE ("causaRiesgoOrigenId");
    END IF;
END $$;

-- Crear foreign key para causaRiesgoOrigenId
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Control_causaRiesgoOrigenId_fkey'
    ) THEN
        ALTER TABLE "Control" 
        ADD CONSTRAINT "Control_causaRiesgoOrigenId_fkey" 
        FOREIGN KEY ("causaRiesgoOrigenId") 
        REFERENCES "CausaRiesgo"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS "Control_causaRiesgoOrigenId_idx" 
ON "Control"("causaRiesgoOrigenId");

-- =====================================================
-- PASO 3: Crear índices para optimizar queries en JSON
-- =====================================================

-- Índice para buscar causas con planes (tipoGestion)
CREATE INDEX IF NOT EXISTS "CausaRiesgo_tipoGestion_idx" 
ON "CausaRiesgo"("tipoGestion");

-- Índice GIN para búsquedas en el campo JSON gestion
-- Esto acelera queries como: gestion->>'planEstado' = 'pendiente'
CREATE INDEX IF NOT EXISTS "CausaRiesgo_gestion_gin_idx" 
ON "CausaRiesgo" USING GIN ("gestion");

-- Índice para riesgoId (ya debería existir, pero lo verificamos)
CREATE INDEX IF NOT EXISTS "CausaRiesgo_riesgoId_idx" 
ON "CausaRiesgo"("riesgoId");

COMMIT;

-- =====================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Verificar que la tabla AlertaVencimiento se creó
SELECT COUNT(*) as total_alertas FROM "AlertaVencimiento";

-- Verificar que los campos se agregaron a Control
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Control' 
    AND column_name IN ('causaRiesgoOrigenId', 'fechaCreacionDesdePlan')
ORDER BY column_name;

-- Verificar índices creados
SELECT 
    indexname, 
    tablename 
FROM pg_indexes 
WHERE tablename IN ('AlertaVencimiento', 'Control', 'CausaRiesgo')
    AND (
        indexname LIKE '%Alerta%' 
        OR indexname LIKE '%causaRiesgoOrigen%'
        OR indexname LIKE '%tipoGestion%'
        OR indexname LIKE '%gestion_gin%'
    )
ORDER BY tablename, indexname;

-- Verificar causas con planes
SELECT 
    COUNT(*) as total_causas_con_plan,
    COUNT(CASE WHEN "tipoGestion" = 'PLAN' THEN 1 END) as solo_plan,
    COUNT(CASE WHEN "tipoGestion" = 'AMBOS' THEN 1 END) as plan_y_control
FROM "CausaRiesgo"
WHERE "tipoGestion" IN ('PLAN', 'AMBOS');

-- =====================================================
-- QUERIES ÚTILES PARA DESARROLLO
-- =====================================================

-- Ver planes con sus datos
/*
SELECT 
    cr.id as causa_id,
    cr."riesgoId",
    r."numeroIdentificacion" as riesgo_numero,
    cr.descripcion as causa_descripcion,
    cr."tipoGestion",
    cr.gestion->>'planDescripcion' as plan_descripcion,
    cr.gestion->>'planResponsable' as plan_responsable,
    cr.gestion->>'planFechaEstimada' as plan_fecha_estimada,
    cr.gestion->>'planEstado' as plan_estado,
    cr.gestion->>'controlDerivadoId' as control_derivado_id,
    cr.gestion->>'fechaConversion' as fecha_conversion
FROM "CausaRiesgo" cr
LEFT JOIN "Riesgo" r ON r.id = cr."riesgoId"
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
ORDER BY cr."riesgoId", cr.id;
*/

-- Buscar planes próximos a vencer
/*
SELECT 
    cr.id,
    cr."riesgoId",
    cr.gestion->>'planDescripcion' as plan,
    cr.gestion->>'planFechaEstimada' as fecha_estimada,
    cr.gestion->>'planEstado' as estado,
    (cr.gestion->>'planFechaEstimada')::date - CURRENT_DATE as dias_restantes
FROM "CausaRiesgo" cr
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
  AND cr.gestion->>'planFechaEstimada' IS NOT NULL
  AND cr.gestion->>'planEstado' NOT IN ('completado', 'cancelado')
  AND (cr.gestion->>'planFechaEstimada')::date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY (cr.gestion->>'planFechaEstimada')::date;
*/

-- =====================================================
-- ROLLBACK (En caso de necesitar revertir)
-- =====================================================

-- DESCOMENTAR Y EJECUTAR SOLO SI NECESITAS REVERTIR:

/*
BEGIN;

-- Eliminar tabla AlertaVencimiento
DROP TABLE IF EXISTS "AlertaVencimiento" CASCADE;

-- Eliminar foreign key y constraint de Control
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_causaRiesgoOrigenId_fkey";
ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_causaRiesgoOrigenId_key";

-- Eliminar índices
DROP INDEX IF EXISTS "Control_causaRiesgoOrigenId_idx";
DROP INDEX IF EXISTS "CausaRiesgo_tipoGestion_idx";
DROP INDEX IF EXISTS "CausaRiesgo_gestion_gin_idx";

-- Eliminar columnas de Control
ALTER TABLE "Control" DROP COLUMN IF EXISTS "causaRiesgoOrigenId";
ALTER TABLE "Control" DROP COLUMN IF EXISTS "fechaCreacionDesdePlan";

COMMIT;
*/

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

/*
ESTRUCTURA DEL JSON gestion (EXTENDIDA):

El campo gestion en CausaRiesgo ahora puede contener:

{
  // Campos existentes (NO se modifican)
  "planDescripcion": "Descripción del plan",
  "planResponsable": "Nombre del responsable",
  "planFechaEstimada": "2026-02-28",
  "planEstado": "pendiente" | "en_progreso" | "completado" | "cancelado",
  "planDetalle": "Detalles adicionales",
  "planDecision": "Decisión tomada",
  "planEvidencia": "Evidencia del plan",
  
  // NUEVOS CAMPOS (se agregarán vía API, no migración)
  "controlDerivadoId": 123,              // ID del control creado desde este plan
  "fechaConversion": "2026-03-15",       // Fecha de conversión a control
  "historialEstados": [                  // Historial de cambios de estado
    {
      "estado": "pendiente",
      "fecha": "2026-01-01T10:00:00Z",
      "usuario": "Juan Pérez",
      "observacion": "Plan creado"
    },
    {
      "estado": "en_progreso",
      "fecha": "2026-02-01T14:30:00Z",
      "usuario": "Juan Pérez",
      "observacion": "Iniciando implementación"
    }
  ]
}

IMPORTANTE:
- Los campos nuevos se agregarán dinámicamente cuando se usen
- No es necesario migrar datos existentes
- El JSON es flexible y acepta nuevos campos sin problemas
*/
