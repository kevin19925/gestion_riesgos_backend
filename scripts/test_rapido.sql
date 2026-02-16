-- ============================================
-- TEST RÁPIDO: Verificar Calificaciones
-- Ejecuta este script para ver rápidamente el estado de las calificaciones
-- ============================================

-- 1. RESUMEN: Contar riesgos por nivel (esto es lo que debería aparecer en el gráfico)
SELECT 
    COALESCE(e."nivelRiesgo", 'Sin Calificar') AS nivel_riesgo,
    COUNT(*) AS cantidad
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
GROUP BY e."nivelRiesgo"
ORDER BY 
    CASE COALESCE(e."nivelRiesgo", 'Sin Calificar')
        WHEN 'Crítico' THEN 1
        WHEN 'Alto' THEN 2
        WHEN 'Medio' THEN 3
        WHEN 'Bajo' THEN 4
        ELSE 5
    END;

-- 2. VERIFICAR: Riesgos con sus calificaciones (primeros 10)
SELECT 
    r.id,
    r."numero" || COALESCE(r."siglaGerencia", '') AS codigo_riesgo,
    e."riesgoInherente" AS calificacion,
    e."nivelRiesgo" AS nivel,
    e."probabilidad",
    e."impactoGlobal" AS impacto,
    (SELECT COUNT(*) FROM "CausaRiesgo" WHERE "riesgoId" = r.id) AS num_causas
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
ORDER BY r.id
LIMIT 10;

-- 3. VERIFICAR: Riesgos sin calificación (deberían ser 0 si todo está bien)
SELECT 
    COUNT(*) AS riesgos_sin_calificar
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
WHERE e.id IS NULL OR e."riesgoInherente" IS NULL OR e."riesgoInherente" = 0;

-- 4. VERIFICAR: Riesgos con causas pero sin calificación correcta
SELECT 
    r.id,
    r."numero" || COALESCE(r."siglaGerencia", '') AS codigo_riesgo,
    (SELECT COUNT(*) FROM "CausaRiesgo" WHERE "riesgoId" = r.id) AS num_causas,
    e."riesgoInherente" AS calificacion_guardada,
    e."nivelRiesgo" AS nivel_guardado
FROM "Riesgo" r
LEFT JOIN "EvaluacionRiesgo" e ON e."riesgoId" = r.id
WHERE (SELECT COUNT(*) FROM "CausaRiesgo" WHERE "riesgoId" = r.id) > 0
AND (e."riesgoInherente" IS NULL OR e."riesgoInherente" = 0);

