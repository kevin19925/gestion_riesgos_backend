-- Procedimiento almacenado: recálculo de clasificación residual en la base de datos.
-- El backend solo invoca SELECT recalcular_residuales_completo() y la BD hace todo el trabajo.

CREATE OR REPLACE FUNCTION recalcular_residuales_completo()
RETURNS TABLE(causas_actualizadas bigint, riesgos_actualizados bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_config_id int;
  v_causas_count bigint := 0;
  v_riesgos_count bigint := 0;
  v_pa float; v_pc float; v_pf float; v_ps float; v_pn float;
  r record;
  g jsonb;
  v_puntaje_total float;
  v_eval_prelim text;
  v_eval_def text;
  v_desviaciones text;
  v_porcentaje float;
  v_tipo_mit text;
  v_freq_inh int; v_imp_inh int;
  v_by int; v_bz int;
  v_ca float;
  v_nivel text;
  v_gestion_nueva jsonb;
  v_riesgo_ids int[] := '{}';
  v_riesgo_id int;
  v_max_ca float;
  v_fr int; v_ir int; v_rr float; v_nr text;
BEGIN
  -- Configuración activa
  SELECT id INTO v_config_id FROM "ConfiguracionResidual" WHERE activa = true LIMIT 1;
  IF v_config_id IS NULL THEN
    causas_actualizadas := 0;
    riesgos_actualizados := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Pesos (por criterio)
  SELECT COALESCE(MAX(CASE WHEN criterio = 'aplicabilidad' THEN peso END), 0) INTO v_pa FROM "PesoCriterioResidual" WHERE "configId" = v_config_id AND activo;
  SELECT COALESCE(MAX(CASE WHEN criterio = 'cobertura' THEN peso END), 0) INTO v_pc FROM "PesoCriterioResidual" WHERE "configId" = v_config_id AND activo;
  SELECT COALESCE(MAX(CASE WHEN criterio = 'facilidad' THEN peso END), 0) INTO v_pf FROM "PesoCriterioResidual" WHERE "configId" = v_config_id AND activo;
  SELECT COALESCE(MAX(CASE WHEN criterio = 'segregacion' THEN peso END), 0) INTO v_ps FROM "PesoCriterioResidual" WHERE "configId" = v_config_id AND activo;
  SELECT COALESCE(MAX(CASE WHEN criterio = 'naturaleza' THEN peso END), 0) INTO v_pn FROM "PesoCriterioResidual" WHERE "configId" = v_config_id AND activo;

  -- Recorrer causas con CONTROL o AMBOS y con datos de gestión
  FOR r IN
    SELECT c.id AS causa_id, c."riesgoId", c.gestion,
           e.probabilidad, e."impactoMaximo"
    FROM "CausaRiesgo" c
    JOIN "EvaluacionRiesgo" e ON e."riesgoId" = c."riesgoId"
    WHERE c."tipoGestion" IN ('CONTROL', 'AMBOS')
      AND c.gestion IS NOT NULL
      AND (
        c.gestion->>'puntajeAplicabilidad' IS NOT NULL
        OR c.gestion->>'aplicabilidad' IS NOT NULL
        OR c.gestion->>'puntajeCobertura' IS NOT NULL
        OR c.gestion->>'puntajeTotal' IS NOT NULL
        OR c.gestion->>'puntajeFacilidad' IS NOT NULL
      )
  LOOP
    g := r.gestion::jsonb;
    v_freq_inh := GREATEST(1, LEAST(5, COALESCE(r.probabilidad, 1)));
    v_imp_inh := GREATEST(1, LEAST(5, COALESCE(r."impactoMaximo", 1)));

    -- 1. Puntaje total
    v_puntaje_total :=
      COALESCE((g->>'puntajeAplicabilidad')::float, 0) * v_pa +
      COALESCE((g->>'puntajeCobertura')::float, 0) * v_pc +
      COALESCE((g->>'puntajeFacilidad')::float, 0) * v_pf +
      COALESCE((g->>'puntajeSegregacion')::float, 0) * v_ps +
      COALESCE((g->>'puntajeNaturaleza')::float, 0) * v_pn;

    -- 2. Evaluación preliminar (primer rango que cumple)
    SELECT re."nivelNombre" INTO v_eval_prelim
    FROM "RangoEvaluacionResidual" re
    WHERE re."configId" = v_config_id AND re.activo
      AND (NOT re."incluirMinimo" OR v_puntaje_total >= re."valorMinimo")
      AND (re."incluirMinimo" OR v_puntaje_total > re."valorMinimo")
      AND (NOT re."incluirMaximo" OR v_puntaje_total <= re."valorMaximo")
      AND (re."incluirMaximo" OR v_puntaje_total < re."valorMaximo")
    ORDER BY re.orden
    LIMIT 1;
    v_eval_prelim := COALESCE(v_eval_prelim, 'Inefectivo');

    -- 3. Evaluación definitiva (desviaciones)
    v_desviaciones := COALESCE(g->>'desviaciones', 'A');
    IF v_desviaciones = 'C' THEN
      v_eval_def := 'Inefectivo';
    ELSIF v_desviaciones = 'B' AND v_eval_prelim = 'Altamente Efectivo' THEN
      v_eval_def := 'Efectivo';
    ELSE
      v_eval_def := v_eval_prelim;
    END IF;

    -- 4. Porcentaje mitigación
    SELECT tm.porcentaje INTO v_porcentaje
    FROM "TablaMitigacionResidual" tm
    WHERE tm."configId" = v_config_id AND tm.activo AND tm.evaluacion = v_eval_def
    LIMIT 1;
    v_porcentaje := COALESCE(v_porcentaje, 0);
    v_tipo_mit := COALESCE(g->>'tipoMitigacion', 'AMBAS');

    -- 5. Frecuencia residual (BY) — regla 34% en dimensión cruzada
    IF v_tipo_mit IN ('FRECUENCIA', 'AMBAS') THEN
      v_by := GREATEST(1, LEAST(5, CEIL(v_freq_inh - v_freq_inh * v_porcentaje)::int));
    ELSIF v_tipo_mit = 'IMPACTO' AND v_eval_def IN ('Efectivo', 'Altamente Efectivo') THEN
      v_by := GREATEST(1, LEAST(5, CEIL(v_freq_inh - v_freq_inh * 0.34)::int));
    ELSE
      v_by := v_freq_inh;
    END IF;

    -- 6. Impacto residual (BZ)
    IF v_tipo_mit IN ('IMPACTO', 'AMBAS') THEN
      v_bz := GREATEST(1, LEAST(5, CEIL(v_imp_inh - v_imp_inh * v_porcentaje)::int));
    ELSIF v_tipo_mit = 'FRECUENCIA' AND v_eval_def IN ('Efectivo', 'Altamente Efectivo') THEN
      v_bz := GREATEST(1, LEAST(5, CEIL(v_imp_inh - v_imp_inh * 0.34)::int));
    ELSE
      v_bz := v_imp_inh;
    END IF;

    -- 7. Calificación residual (CA) — excepción 2×2 = 3.99
    v_ca := v_by * v_bz;
    IF v_by = 2 AND v_bz = 2 THEN
      v_ca := 3.99;
    END IF;

    -- 8. Nivel riesgo residual
    SELECT rn."nivelNombre" INTO v_nivel
    FROM "RangoNivelRiesgoResidual" rn
    WHERE rn."configId" = v_config_id AND rn.activo
      AND (NOT rn."incluirMinimo" OR v_ca >= rn."valorMinimo")
      AND (rn."incluirMinimo" OR v_ca > rn."valorMinimo")
      AND (NOT rn."incluirMaximo" OR v_ca <= rn."valorMaximo")
      AND (rn."incluirMaximo" OR v_ca < rn."valorMaximo")
    ORDER BY rn.orden
    LIMIT 1;
    v_nivel := COALESCE(v_nivel, 'NIVEL BAJO');

    -- 9. Actualizar gestion en CausaRiesgo
    v_gestion_nueva := g
      || jsonb_build_object(
           'puntajeTotal', v_puntaje_total,
           'evaluacionPreliminar', v_eval_prelim,
           'evaluacionDefinitiva', v_eval_def,
           'porcentajeMitigacion', v_porcentaje,
           'frecuenciaResidual', v_by,
           'impactoResidual', v_bz,
           'calificacionResidual', v_ca,
           'nivelRiesgoResidual', v_nivel,
           'recalculadoEn', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         );

    UPDATE "CausaRiesgo"
    SET gestion = v_gestion_nueva
    WHERE id = r.causa_id;

    v_causas_count := v_causas_count + 1;
    v_riesgo_ids := array_append(v_riesgo_ids, r."riesgoId");
  END LOOP;

  -- Actualizar EvaluacionRiesgo por cada riesgo afectado (usar causa con mayor calificacionResidual)
  FOR v_riesgo_id IN SELECT DISTINCT unnest(v_riesgo_ids)
    LOOP
      SELECT
        (gestion->>'frecuenciaResidual')::int,
        (gestion->>'impactoResidual')::int,
        (gestion->>'calificacionResidual')::float,
        gestion->>'nivelRiesgoResidual'
      INTO v_fr, v_ir, v_rr, v_nr
      FROM "CausaRiesgo"
      WHERE "riesgoId" = v_riesgo_id
        AND "tipoGestion" IN ('CONTROL', 'AMBOS')
        AND gestion IS NOT NULL
        AND (gestion->>'calificacionResidual') IS NOT NULL
      ORDER BY (gestion->>'calificacionResidual')::float DESC NULLS LAST
      LIMIT 1;

      IF v_fr IS NOT NULL AND v_ir IS NOT NULL THEN
        UPDATE "EvaluacionRiesgo"
        SET
          "probabilidadResidual" = v_fr,
          "impactoResidual" = v_ir,
          "riesgoResidual" = ROUND(v_rr)::int,
          "nivelRiesgoResidual" = COALESCE(v_nr, 'NIVEL BAJO')
        WHERE "riesgoId" = v_riesgo_id;
        v_riesgos_count := v_riesgos_count + 1;
      END IF;
    END LOOP;

  causas_actualizadas := v_causas_count;
  riesgos_actualizados := v_riesgos_count;
  RETURN NEXT;
  RETURN;
END;
$$;
