-- =============================================================================
-- RECALCULAR UBICACIÓN EN MAPA = mismo cálculo que "Guardar" general en la app
-- =============================================================================
-- Este script replica PASO A PASO lo que hace el frontend al pulsar "Guardar" en
-- un riesgo (recalcularYGuardarCalificacionInherenteGlobal):
--
--  1. Calificación global impacto = CEIL( suma(dimensión × peso) ) con pesos por defecto
--     (personas 0.10, legal 0.22, ambiental 0.10, procesos 0.14, reputacion 0.22, economico 0.22, SGSI 0)
--  2. Por cada causa: peso frecuencia = FrecuenciaCatalog por id (peso ?? id) o por label (peso ?? 3)
--  3. Por cada causa: cal = excepción 2×2→3.99, sino peso_frec × impacto_para_formula
--  4. Calificación inherente global = MÁXIMO de las cal (agregación "Máximo")
--  5. Nivel riesgo = según rangos de CalificacionInherenteConfig activa
--  6. Causa ganadora = la de mayor cal → probabilidad = su frecuencia (1-5), impacto = impacto (1-5)
--  7. UPDATE EvaluacionRiesgo: riesgoInherente, nivelRiesgo, probabilidad, impactoGlobal
--
-- Ejecutar: psql "$DATABASE_URL" -f scripts/recalcular_ubicacion_mapa_riesgos.sql
-- =============================================================================

BEGIN;

-- (1) Calificación global impacto = igual que Guardar: CEIL( suma(dim × peso) )
--     Si la suma da 0 o 1 (dimensiones por defecto/no guardadas), usar impactoGlobal ya guardado
--     para no recolocar mal riesgos que Guardar ya ubicó bien (ej. impacto 3 en celda 5,3).
WITH impacto_calculado AS (
  SELECT
    e."riesgoId",
    CEIL(
      COALESCE(e."impactoPersonas", 1) * 0.10 +
      COALESCE(e."impactoLegal", 1) * 0.22 +
      COALESCE(e."impactoAmbiental", 1) * 0.10 +
      COALESCE(e."impactoProcesos", 1) * 0.14 +
      COALESCE(e."impactoReputacion", 1) * 0.22 +
      COALESCE(e."impactoEconomico", 1) * 0.22 +
      COALESCE(e."confidencialidadSGSI", 1) * 0.0 +
      COALESCE(e."disponibilidadSGSI", 1) * 0.0 +
      COALESCE(e."integridadSGSI", 1) * 0.0
    )::int AS impacto_sum,
    GREATEST(1, LEAST(5, COALESCE(e."impactoGlobal", 1))) AS impacto_guardado
  FROM "EvaluacionRiesgo" e
  INNER JOIN "Riesgo" r ON r.id = e."riesgoId"
  WHERE EXISTS (SELECT 1 FROM "CausaRiesgo" c WHERE c."riesgoId" = r.id)
),
impacto_efectivo AS (
  SELECT
    "riesgoId",
    -- Usar suma de dimensiones solo si >= 2; si es 0 o 1, usar impacto ya guardado (como cuando Guardar ya lo puso bien)
    GREATEST(1, CASE WHEN impacto_sum >= 2 THEN impacto_sum ELSE impacto_guardado END) AS impacto_para_formula,
    GREATEST(1, LEAST(5, CASE WHEN impacto_sum >= 2 THEN impacto_sum ELSE impacto_guardado END)) AS impacto_eje
  FROM impacto_calculado
),

-- (2) Peso de frecuencia por causa = igual que Guardar: por id (peso ?? freqId) o por label (peso ?? 3).
--     Si peso = 3 (valor por defecto del catálogo), usar id para escala 1-5 y que 5×3=15 sea coherente.
frecuencia_peso AS (
  SELECT
    c.id AS "causaId",
    c."riesgoId",
    COALESCE(
      (SELECT COALESCE(NULLIF(f.peso, 3), f.id) FROM "FrecuenciaCatalog" f WHERE c.frecuencia IS NOT NULL AND TRIM(c.frecuencia) ~ '^\s*\d+\s*$' AND f.id = TRIM(c.frecuencia)::int),
      (SELECT COALESCE(NULLIF(f.peso, 3), f.id, 3) FROM "FrecuenciaCatalog" f WHERE c.frecuencia IS NOT NULL AND TRIM(c.frecuencia) <> '' AND LOWER(TRIM(f.label)) = LOWER(TRIM(c.frecuencia))),
      CASE WHEN c.frecuencia IS NOT NULL AND TRIM(c.frecuencia) ~ '^\s*\d+\s*$' THEN LEAST(5, GREATEST(1, TRIM(c.frecuencia)::int)) ELSE NULL END,
      3
    )::int AS peso_frec,
    LEAST(5, GREATEST(1, COALESCE(
      (SELECT COALESCE(NULLIF(f.peso, 3), f.id) FROM "FrecuenciaCatalog" f WHERE c.frecuencia IS NOT NULL AND TRIM(c.frecuencia) ~ '^\s*\d+\s*$' AND f.id = TRIM(c.frecuencia)::int),
      (SELECT COALESCE(NULLIF(f.peso, 3), f.id, 3) FROM "FrecuenciaCatalog" f WHERE c.frecuencia IS NOT NULL AND TRIM(c.frecuencia) <> '' AND LOWER(TRIM(f.label)) = LOWER(TRIM(c.frecuencia))),
      3
    )::int)) AS frecuencia_eje
  FROM "CausaRiesgo" c
  WHERE EXISTS (SELECT 1 FROM "EvaluacionRiesgo" e WHERE e."riesgoId" = c."riesgoId")
),

-- (3) Cal por causa = igual que Guardar: 2×2→3.99, sino multiplicación
cal_por_causa AS (
  SELECT
    fp."riesgoId",
    fp."causaId",
    fp.peso_frec,
    fp.frecuencia_eje,
    ie.impacto_para_formula,
    ie.impacto_eje,
    CASE
      WHEN fp.peso_frec = 2 AND ie.impacto_para_formula = 2 THEN 3.99
      ELSE (fp.peso_frec * ie.impacto_para_formula)
    END AS cal
  FROM frecuencia_peso fp
  INNER JOIN impacto_efectivo ie ON ie."riesgoId" = fp."riesgoId"
),

-- (4) y (6) Causa ganadora = la de mayor cal (Máximo). probabilidad = su frecuencia_eje, impacto = impacto_eje
rank_causas AS (
  SELECT
    "riesgoId", "causaId", peso_frec, frecuencia_eje, impacto_eje, cal,
    ROW_NUMBER() OVER (PARTITION BY "riesgoId" ORDER BY cal DESC, "causaId") AS rn
  FROM cal_por_causa
),
causa_ganadora AS (
  SELECT "riesgoId", frecuencia_eje, impacto_eje, cal
  FROM rank_causas
  WHERE rn = 1
),

-- (5) Nivel según rangos de config activa (Admin > Calificación Inherente)
config_activa AS (
  SELECT id FROM "CalificacionInherenteConfig" WHERE activa = true LIMIT 1
),
rangos_activos AS (
  SELECT r."nivelNombre", r."valorMinimo", r."valorMaximo", r."incluirMinimo", r."incluirMaximo", r.orden
  FROM "RangoCalificacion" r
  INNER JOIN config_activa ca ON ca.id = r."configId"
  WHERE r.activo = true
  ORDER BY r.orden
),
nivel_por_valor AS (
  SELECT
    cg."riesgoId",
    cg.cal,
    ROUND(cg.cal)::int AS riesgo_inherente_redondo,
    cg.frecuencia_eje AS probabilidad_map,
    cg.impacto_eje AS impacto_map,
    (
      SELECT ra."nivelNombre"
      FROM rangos_activos ra
      WHERE (ra."incluirMinimo" AND cg.cal >= ra."valorMinimo" OR NOT ra."incluirMinimo" AND cg.cal > ra."valorMinimo")
        AND (ra."incluirMaximo" AND cg.cal <= ra."valorMaximo" OR NOT ra."incluirMaximo" AND cg.cal < ra."valorMaximo")
      ORDER BY ra.orden
      LIMIT 1
    ) AS nivel
  FROM causa_ganadora cg
),

valores_finales AS (
  SELECT
    "riesgoId",
    riesgo_inherente_redondo,
    COALESCE(nivel, 'Sin Calificar') AS nivel_riesgo,
    probabilidad_map,
    impacto_map
  FROM nivel_por_valor
)

-- (7) UPDATE = mismo payload que Guardar: riesgoInherente, nivelRiesgo, probabilidad, impactoGlobal
UPDATE "EvaluacionRiesgo" e
SET
  "riesgoInherente"   = v.riesgo_inherente_redondo,
  "nivelRiesgo"       = v.nivel_riesgo,
  "probabilidad"      = v.probabilidad_map,
  "impactoGlobal"     = v.impacto_map
FROM valores_finales v
WHERE e."riesgoId" = v."riesgoId";

COMMIT;
