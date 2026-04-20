SELECT id, descripcion, clasificacion, "procesoId", "createdAt"
FROM "Riesgo"
WHERE clasificacion = 'Riesgo con consecuencia positiva'
ORDER BY "createdAt" DESC
LIMIT 20;
