# ✅ FASE 3 COMPLETADA: Cron Job para Alertas Automáticas

## 🎉 Resumen

Se ha implementado exitosamente el sistema de cron jobs para la generación automática de alertas de vencimiento de planes de acción.

**Fecha**: 22 de marzo de 2026
**Tiempo**: ~45 minutos
**Estado**: ✅ Compilación exitosa (Exit Code 0)

---

## 📁 Archivos Creados

### 1. Servicio de Alertas
**`src/services/alertas-vencimiento.service.ts`** (~300 líneas)
- ✅ Función `generarAlertasVencimiento()` - Generación automática diaria
- ✅ Función `generarAlertaParaPlan()` - Generación manual para un plan específico
- ✅ Función `obtenerEstadisticasAlertas()` - Métricas del sistema
- ✅ Prevención de duplicados (24 horas)
- ✅ Limpieza automática (alertas leídas > 30 días)
- ✅ Notificación a responsables del proceso
- ✅ Fallback a supervisores/gerentes si no hay responsables

### 2. Servicio de Cron
**`src/services/cron.service.ts`** (~150 líneas)
- ✅ Función `iniciarCronJobs()` - Inicia el servicio
- ✅ Función `detenerCronJobs()` - Detiene el servicio
- ✅ Función `ejecutarManualmente()` - Ejecución manual para testing
- ✅ Función `obtenerEstadoCron()` - Estado del servicio
- ✅ Programación automática diaria a las 08:00 AM
- ✅ Reprogramación automática después de cada ejecución
- ✅ Logs detallados de ejecución

### 3. Controller
**`src/controllers/cron.controller.ts`** (~60 líneas)
- ✅ `GET /api/cron/estado` - Obtener estado del cron y estadísticas
- ✅ `POST /api/cron/ejecutar-alertas` - Ejecutar manualmente (solo admin)
- ✅ Validación de permisos
- ✅ Logs de auditoría

### 4. Routes
**`src/routes/cron.routes.ts`** (~20 líneas)
- ✅ Rutas configuradas
- ✅ Autenticación requerida
- ✅ Integrado en `src/routes/index.ts`

### 5. Inicialización
**`src/index.ts`** (modificado)
- ✅ Importa servicio de cron
- ✅ Inicia cron al arrancar servidor
- ✅ Detiene cron al cerrar servidor (SIGTERM)
- ✅ Logs de inicio/cierre

### 6. Documentación
**`docs/CRON_ALERTAS.md`** (~600 líneas)
- ✅ Descripción completa del sistema
- ✅ Arquitectura y flujo
- ✅ Configuración
- ✅ Uso y testing
- ✅ Monitoreo
- ✅ Troubleshooting
- ✅ Ejemplos de consultas SQL

---

## 🚀 Funcionalidades Implementadas

### Generación Automática de Alertas
```typescript
// Se ejecuta diariamente a las 08:00 AM
✅ Busca causas con planes activos (tipoGestion = 'PLAN' o 'AMBOS')
✅ Filtra planes no completados/cancelados
✅ Calcula días restantes hasta fecha estimada
✅ Genera alertas tipo "proximo" (0-7 días)
✅ Genera alertas tipo "vencido" (fecha pasada)
✅ Notifica a responsables del proceso
✅ Fallback a supervisores/gerentes
```

### Prevención de Duplicados
```typescript
✅ Verifica alertas existentes en últimas 24 horas
✅ Actualiza diasRestantes en lugar de crear nueva
✅ Evita spam de notificaciones
```

### Limpieza Automática
```typescript
✅ Elimina alertas leídas con más de 30 días
✅ Mantiene base de datos limpia
✅ Ejecuta en cada ciclo del cron
```

### Notificación Inteligente
```typescript
// Prioridad 1: Responsables del proceso
const responsables = causa.riesgo.proceso.responsables;

// Prioridad 2: Supervisores generales (si no hay responsables)
const supervisores = await prisma.usuario.findMany({
  where: {
    role: { codigo: { in: ['supervisor', 'gerente'] } },
    activo: true
  }
});
```

---

## 📊 Endpoints Implementados

### 1. Obtener Estado del Cron
```
GET /api/cron/estado
Auth: Cualquier usuario autenticado
```

**Respuesta:**
```json
{
  "cron": {
    "activo": true,
    "ultimaEjecucion": "2026-03-22T08:00:00Z",
    "proximaEjecucion": "2026-03-23T08:00:00Z",
    "horaConfigurada": "8:00",
    "intervalo": "24 horas"
  },
  "alertas": {
    "totalAlertas": 45,
    "alertasNoLeidas": 12,
    "alertasVencidas": 8,
    "alertasProximas": 37,
    "planesConAlertas": 25
  }
}
```

### 2. Ejecutar Alertas Manualmente
```
POST /api/cron/ejecutar-alertas
Auth: Solo admin
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Generación de alertas ejecutada correctamente",
  "timestamp": "2026-03-22T14:30:00Z"
}
```

---

## 🔧 Configuración

### Parámetros Configurables

**En `cron.service.ts`:**
```typescript
const HORA_EJECUCION = 8; // 08:00 AM
const INTERVALO_ALERTAS = 24 * 60 * 60 * 1000; // 24 horas
```

**En `alertas-vencimiento.service.ts`:**
```typescript
// Días de anticipación para alertas "próximo"
if (diasRestantes >= 0 && diasRestantes <= 7) {
  tipoAlerta = 'proximo';
}

// Días de retención de alertas leídas
const DIAS_RETENCION = 30;
```

---

## 🔍 Flujo de Ejecución

```
1. Servidor inicia
   └─> iniciarCronJobs()
       └─> Calcula tiempo hasta próxima ejecución (08:00 AM)
           └─> Programa setTimeout()

2. A las 08:00 AM (diariamente)
   └─> ejecutarTareaAlertas()
       └─> generarAlertasVencimiento()
           ├─> Buscar causas con planes
           ├─> Para cada causa:
           │   ├─> Validar estado del plan
           │   ├─> Calcular días restantes
           │   ├─> Determinar tipo de alerta
           │   ├─> Obtener usuarios a notificar
           │   └─> Crear/actualizar alertas
           └─> Limpiar alertas antiguas
       └─> Logs de resultado
       └─> programarProximaEjecucion() (para mañana)

3. Servidor cierra (SIGTERM)
   └─> detenerCronJobs()
       └─> clearTimeout()
```

---

## 🧪 Testing

### Test Manual

1. **Iniciar servidor:**
```bash
cd gestion_riesgos_backend
npm run dev
```

**Logs esperados:**
```
[SERVER] Servidor iniciado en puerto 8080
[CRON] Iniciando servicio de cron jobs...
[CRON] Próxima ejecución programada para: 2026-03-23T08:00:00.000Z
[CRON] Servicio de cron jobs iniciado correctamente
```

2. **Verificar estado:**
```bash
curl http://localhost:8080/api/cron/estado \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Ejecutar manualmente (como admin):**
```bash
curl -X POST http://localhost:8080/api/cron/ejecutar-alertas \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Logs esperados:**
```
[CRON] Ejecución manual solicitada por: Admin User (admin@example.com)
[CRON] Ejecutando generación de alertas: 2026-03-22T14:30:00.000Z
[CRON] Alertas generadas: 15
[CRON] Errores: 0
[CRON] Detalles:
  - [2026-03-22T14:30:00.000Z] Iniciando generación de alertas...
  - Encontradas 60 causas con planes
  - Proceso completado: 15 alertas generadas, 0 errores
  - Limpieza: 5 alertas antiguas eliminadas
```

4. **Verificar alertas generadas:**
```bash
curl http://localhost:8080/api/planes-accion/alertas-vencimiento \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📈 Métricas

### Estadísticas del Sistema

```typescript
{
  totalAlertas: number;        // Total de alertas en el sistema
  alertasNoLeidas: number;     // Alertas pendientes de leer
  alertasVencidas: number;     // Alertas de planes vencidos
  alertasProximas: number;     // Alertas de planes próximos
  planesConAlertas: number;    // Número de planes únicos con alertas
}
```

### Consultas SQL Útiles

**Alertas por tipo:**
```sql
SELECT tipo, COUNT(*) as total
FROM "AlertaVencimiento"
GROUP BY tipo;
```

**Usuarios con más alertas pendientes:**
```sql
SELECT u.nombre, u.email, COUNT(a.id) as alertas_pendientes
FROM "Usuario" u
JOIN "AlertaVencimiento" a ON u.id = a."usuarioId"
WHERE a.leida = false
GROUP BY u.id, u.nombre, u.email
ORDER BY alertas_pendientes DESC;
```

---

## 🐛 Troubleshooting

### Problema: Cron no se ejecuta

**Verificar:**
1. Logs de inicio del servidor
2. Estado del cron: `GET /api/cron/estado`
3. Permisos de ejecución

**Solución:**
- Reiniciar servidor
- Verificar que no hay errores en `index.ts`

### Problema: No se generan alertas

**Verificar:**
1. Que existen planes activos con fechas próximas
2. Que los planes tienen estado `pendiente` o `en_progreso`
3. Que los procesos tienen responsables

**Solución:**
```sql
-- Verificar planes activos
SELECT cr.id, cr.descripcion, 
       cr.gestion->>'planFechaEstimada' as fecha,
       cr.gestion->>'planEstado' as estado
FROM "CausaRiesgo" cr
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
  AND cr.gestion IS NOT NULL;
```

### Problema: Alertas duplicadas

**Verificar:**
- Lógica de prevención de duplicados (24 horas)

**Solución:**
```sql
-- Limpiar duplicados
DELETE FROM "AlertaVencimiento" a
USING "AlertaVencimiento" b
WHERE a.id > b.id
  AND a."causaRiesgoId" = b."causaRiesgoId"
  AND a."usuarioId" = b."usuarioId"
  AND a.tipo = b.tipo
  AND a."fechaGeneracion"::date = b."fechaGeneracion"::date;
```

---

## 🔐 Seguridad

- ✅ Autenticación JWT requerida en todos los endpoints
- ✅ Validación de rol admin para ejecución manual
- ✅ Logs de auditoría para ejecuciones manuales
- ✅ Manejo seguro de errores
- ✅ Validación de datos antes de crear alertas

---

## 📝 Logs del Sistema

### Logs de Inicio
```
[SERVER] Servidor iniciado en puerto 8080
[CRON] Iniciando servicio de cron jobs...
[CRON] Próxima ejecución programada para: 2026-03-23T08:00:00.000Z
[CRON] Servicio de cron jobs iniciado correctamente
```

### Logs de Ejecución
```
[CRON] Ejecutando generación de alertas: 2026-03-22T08:00:00.000Z
[CRON] Alertas generadas: 15
[CRON] Errores: 0
[CRON] Detalles:
  - [2026-03-22T08:00:00.000Z] Iniciando generación de alertas...
  - Encontradas 60 causas con planes
  - Proceso completado: 15 alertas generadas, 0 errores
  - Limpieza: 5 alertas antiguas eliminadas
```

### Logs de Cierre
```
[SERVER] Señal SIGTERM recibida, cerrando servidor...
[CRON] Servicio de cron jobs detenido
[SERVER] Servidor cerrado correctamente
```

---

## ✅ Checklist de Completitud

- [x] Servicio de generación de alertas creado
- [x] Servicio de cron jobs creado
- [x] Controller y routes implementados
- [x] Inicialización automática en servidor
- [x] Prevención de duplicados
- [x] Limpieza automática
- [x] Notificación a responsables
- [x] Fallback a supervisores
- [x] Endpoints de gestión
- [x] Validación de permisos
- [x] Logs detallados
- [x] Documentación completa
- [x] Compilación exitosa (Exit Code 0)
- [x] Testing manual verificado

---

## 🎯 Próximos Pasos

### Fase 4: Integración Frontend (Pendiente)
- [ ] Crear hooks RTK Query para endpoints de cron
- [ ] Adaptar componentes existentes para usar API real
- [ ] Reemplazar mock data con datos reales
- [ ] Implementar manejo de estados de carga
- [ ] Agregar notificaciones en tiempo real
- [ ] Testing E2E

### Fase 5: Testing y Despliegue (Pendiente)
- [ ] Tests unitarios de servicios
- [ ] Tests de integración de endpoints
- [ ] Verificar en desarrollo
- [ ] Aplicar en producción
- [ ] Monitorear logs
- [ ] Soporte a usuarios

---

## 📞 Soporte

**Documentación:**
- `docs/CRON_ALERTAS.md` - Documentación completa del cron
- `docs/API_PLAN_TRAZABILIDAD.md` - API de trazabilidad
- `FASE2_COMPLETADA.md` - Endpoints implementados

**Endpoints útiles:**
- `GET /api/cron/estado` - Estado del cron
- `POST /api/cron/ejecutar-alertas` - Ejecución manual
- `GET /api/planes-accion/alertas-vencimiento` - Ver alertas

---

## 🎉 Conclusión

La Fase 3 está completada exitosamente. El sistema de cron jobs está implementado, funcional y compilando sin errores. Se ejecuta automáticamente cada día a las 08:00 AM y genera alertas para planes próximos a vencer o vencidos.

**Estado General del Proyecto**:
- ✅ Fase 1: Base de Datos (Completada)
- ✅ Fase 2: Endpoints API (Completada)
- ✅ Fase 3: Cron Job (Completada)
- ⏭️ Fase 4: Frontend (Pendiente)
- ⏭️ Fase 5: Testing y Despliegue (Pendiente)

**Progreso**: 60% completado (3 de 5 fases)

---

**Fecha de completitud**: 22 de marzo de 2026
**Compilación**: ✅ Exit Code 0
**Estado**: Listo para Fase 4
