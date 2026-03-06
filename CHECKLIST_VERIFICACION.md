# ✅ Checklist de Verificación - Optimizaciones Backend

## 🔍 Verificación Inmediata

### 1. Iniciar el Servidor
```bash
cd gestion_riesgos_backend
npm run dev
```

**Deberías ver:**
```
✅ Prisma conectó un nuevo cliente al Pool
Server running on port 8080
```

- [ ] El servidor inicia sin errores
- [ ] Ves el log de conexión al pool
- [ ] No hay errores de "too many connections"

---

### 2. Probar Health Check
```bash
curl http://localhost:8080/api/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-06T...",
  "uptime": 123,
  "memory": {
    "used": 45,
    "total": 128,
    "unit": "MB"
  },
  "environment": "development"
}
```

- [ ] El endpoint responde correctamente
- [ ] El status es "ok"
- [ ] Muestra información de memoria

---

### 3. Verificar Logs del Pool

**Hacer varias peticiones a cualquier endpoint:**
```bash
curl http://localhost:8080/api/procesos
curl http://localhost:8080/api/riesgos
```

**En la consola del servidor deberías ver:**
```
✅ Prisma conectó un nuevo cliente al Pool
```

- [ ] Los logs del pool aparecen
- [ ] No hay errores de conexión
- [ ] Las peticiones se completan exitosamente

---

### 4. Probar Detección de Consultas Lentas

**Hacer una consulta que tarde más de 1 segundo** (si tienes muchos datos):
```bash
curl http://localhost:8080/api/riesgos?includeCausas=true
```

**Si la consulta tarda >1s, deberías ver:**
```
⚠️ CONSULTA LENTA DETECTADA:
   Query: SELECT ...
   Duración: 1523ms
   Params: ...
```

- [ ] Las consultas lentas se detectan
- [ ] Los logs muestran la query completa
- [ ] Puedes identificar qué optimizar

---

### 5. Verificar Patrón Singleton (Desarrollo)

**Guardar cambios en cualquier archivo .ts** (para que nodemon reinicie)

**Deberías ver:**
```
[nodemon] restarting due to changes...
[nodemon] starting `ts-node src/index.ts`
✅ Prisma conectó un nuevo cliente al Pool
```

**NO deberías ver:**
```
❌ Error: too many connections
❌ Error: Connection pool exhausted
```

- [ ] El servidor reinicia correctamente
- [ ] No hay errores de conexiones múltiples
- [ ] Solo se crea una instancia de Prisma

---

## 🚀 Verificación de Rendimiento (Opcional)

### 6. Comparar Tiempos de Respuesta

**Sin caché (primera petición):**
```bash
time curl http://localhost:8080/api/procesos
```

**Con caché (segunda petición):**
```bash
time curl http://localhost:8080/api/procesos
```

**Resultados esperados:**
- Primera petición: ~500-1000ms
- Segunda petición: ~10-50ms (mucho más rápido)

- [ ] La segunda petición es significativamente más rápida
- [ ] El caché está funcionando

---

### 7. Verificar Headers de Monitoreo (Solo Dev)

```bash
curl -I http://localhost:8080/api/procesos
```

**Deberías ver headers como:**
```
X-Response-Time: 234ms
X-Pool-Monitor: enabled
```

- [ ] Los headers de monitoreo aparecen
- [ ] El tiempo de respuesta se muestra

---

## 🔧 Verificación de Configuración

### 8. Revisar Variables de Entorno

**Verificar que `.env` tenga:**
```env
DATABASE_URL="postgresql://..."
PORT=8080
NODE_ENV=development
```

- [ ] DATABASE_URL está configurada
- [ ] La URL no tiene parámetros extra (el pool los maneja)
- [ ] NODE_ENV está definida

---

### 9. Verificar Dependencias

```bash
npm list pg @prisma/adapter-pg @prisma/client redis
```

**Deberías ver:**
```
├── pg@8.18.0
├── @prisma/adapter-pg@7.3.0
├── @prisma/client@7.3.0
└── redis@5.11.0
```

- [ ] Todas las dependencias están instaladas
- [ ] Las versiones son compatibles

---

## 📊 Verificación de Producción

### 10. Preparar para Producción

**Antes de desplegar, verificar:**

- [ ] `NODE_ENV=production` en el servidor
- [ ] Redis está configurado y accesible
- [ ] DATABASE_URL apunta a la DB de producción
- [ ] El pool de 20 conexiones es suficiente para tu tráfico
- [ ] Los logs de consultas lentas están habilitados

---

### 11. Monitoreo Post-Despliegue

**Después de desplegar, verificar:**

- [ ] El servidor inicia sin errores
- [ ] No hay logs de "too many connections"
- [ ] El health check responde correctamente
- [ ] Las consultas lentas se loguean (si las hay)
- [ ] El tiempo de respuesta es aceptable

---

## 🎯 Checklist de Optimizaciones Opcionales

### 12. Migrar Endpoints a SWR (Recomendado)

**Endpoints prioritarios para migrar:**

- [ ] `GET /api/procesos` - Listado de procesos
- [ ] `GET /api/riesgos` - Listado de riesgos
- [ ] `GET /api/estadisticas` - Estadísticas del dashboard
- [ ] `GET /api/areas` - Listado de áreas
- [ ] `GET /api/tipos-riesgo` - Catálogos

**Ver `EJEMPLO_USO_SWR.md` para guía completa**

---

### 13. Agregar Índices en la Base de Datos (Si hay consultas lentas)

**Si ves consultas lentas frecuentes:**

1. Identificar las columnas más consultadas
2. Crear índices en PostgreSQL:
```sql
CREATE INDEX idx_riesgo_proceso_id ON "Riesgo"("procesoId");
CREATE INDEX idx_riesgo_tipo ON "Riesgo"("tipoRiesgoId");
CREATE INDEX idx_proceso_area ON "Proceso"("areaId");
```

- [ ] Índices creados en columnas frecuentes
- [ ] Consultas lentas reducidas

---

### 14. Configurar Rate Limiting (Opcional)

**Para proteger la API:**

```bash
npm install express-rate-limit
```

- [ ] Rate limiting configurado
- [ ] Endpoints críticos protegidos

---

## 📝 Notas Finales

### ✅ Todo Funciona Si:
- El servidor inicia sin errores
- Los logs del pool aparecen
- No hay errores de conexiones
- Las peticiones se completan exitosamente
- El health check responde

### ⚠️ Revisar Si:
- Ves errores de "too many connections"
- Las consultas tardan mucho (>2 segundos)
- El servidor se cae frecuentemente
- Redis no está funcionando

### 🆘 Troubleshooting:
1. Revisa los logs en consola
2. Verifica el health check
3. Consulta `OPTIMIZACIONES_IMPLEMENTADAS.md`
4. Revisa `EJEMPLO_USO_SWR.md`

---

## 🎉 ¡Felicidades!

Si completaste todos los checks principales (1-9), tu backend está optimizado y listo para producción.

**Próximos pasos recomendados:**
1. Migrar endpoints a SWR (ver ejemplos)
2. Monitorear consultas lentas
3. Agregar índices si es necesario
4. Disfrutar de un backend más rápido y estable 🚀
