# 🕐 Sistema de Cron Jobs - Alertas de Vencimiento

## 📋 Descripción

Sistema automatizado que genera alertas de vencimiento para planes de acción de forma diaria. El cron job se ejecuta automáticamente cada día a las 08:00 AM y notifica a los responsables sobre planes próximos a vencer o vencidos.

---

## 🎯 Funcionalidades

### 1. Generación Automática de Alertas
- ✅ Ejecuta diariamente a las 08:00 AM
- ✅ Busca planes activos (pendiente, en_progreso)
- ✅ Identifica planes próximos a vencer (7 días o menos)
- ✅ Identifica planes vencidos (fecha pasada)
- ✅ Notifica a responsables del proceso
- ✅ Evita duplicados (no crea alertas si ya existe una reciente)

### 2. Tipos de Alertas
- **Próximo a vencer**: Planes con 0-7 días restantes
- **Vencido**: Planes con fecha estimada pasada

### 3. Limpieza Automática
- ✅ Elimina alertas leídas con más de 30 días de antigüedad
- ✅ Mantiene la base de datos limpia

---

## 🏗️ Arquitectura

### Archivos Creados

```
gestion_riesgos_backend/
├── src/
│   ├── services/
│   │   ├── alertas-vencimiento.service.ts  ← Lógica de generación de alertas
│   │   └── cron.service.ts                 ← Gestión del cron job
│   ├── controllers/
│   │   └── cron.controller.ts              ← Endpoints de gestión
│   ├── routes/
│   │   └── cron.routes.ts                  ← Rutas del cron
│   └── index.ts                            ← Inicialización del cron
└── docs/
    └── CRON_ALERTAS.md                     ← Esta documentación
```

---

## 🔧 Configuración

### Variables de Entorno

No requiere variables adicionales. Usa la configuración existente de Prisma.

### Parámetros Configurables

En `src/services/cron.service.ts`:

```typescript
// Hora de ejecución diaria (formato 24h)
const HORA_EJECUCION = 8; // 08:00 AM

// Intervalo entre ejecuciones
const INTERVALO_ALERTAS = 24 * 60 * 60 * 1000; // 24 horas
```

En `src/services/alertas-vencimiento.service.ts`:

```typescript
// Días de anticipación para alertas "próximo"
if (diasRestantes >= 0 && diasRestantes <= 7) {
  tipoAlerta = 'proximo';
}

// Días de retención de alertas leídas
const alertasEliminadas = await prisma.alertaVencimiento.deleteMany({
  where: {
    leida: true,
    fechaLectura: {
      lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 días
    }
  }
});
```

---

## 🚀 Uso

### Inicio Automático

El cron job se inicia automáticamente cuando el servidor arranca:

```bash
npm run dev    # Desarrollo
npm start      # Producción
```

**Logs esperados:**
```
[SERVER] Servidor iniciado en puerto 8080
[CRON] Iniciando servicio de cron jobs...
[CRON] Próxima ejecución programada para: 2026-03-23T08:00:00.000Z
[CRON] Servicio de cron jobs iniciado correctamente
```

### Ejecución Manual (Testing)

Para probar el cron job sin esperar a las 08:00 AM:

**Endpoint**: `POST /api/cron/ejecutar-alertas`

**Requisitos**: Usuario con rol `admin`

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:8080/api/cron/ejecutar-alertas \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Generación de alertas ejecutada correctamente",
  "timestamp": "2026-03-22T14:30:00.000Z"
}
```

---

## 📊 Monitoreo

### Obtener Estado del Cron

**Endpoint**: `GET /api/cron/estado`

**Requisitos**: Usuario autenticado (cualquier rol)

**Ejemplo:**
```bash
curl -X GET http://localhost:8080/api/cron/estado \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta:**
```json
{
  "cron": {
    "activo": true,
    "ultimaEjecucion": "2026-03-22T08:00:00.000Z",
    "proximaEjecucion": "2026-03-23T08:00:00.000Z",
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

### Logs del Sistema

El cron job genera logs detallados en la consola:

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

---

## 🔍 Lógica de Generación

### Flujo del Proceso

```
1. Buscar causas con planes
   ├── tipoGestion = 'PLAN' o 'AMBOS'
   └── gestion IS NOT NULL

2. Para cada causa:
   ├── Validar que tiene planFechaEstimada
   ├── Validar que NO está completado/cancelado
   ├── Calcular días restantes
   └── Determinar tipo de alerta
       ├── diasRestantes < 0 → "vencido"
       └── 0 <= diasRestantes <= 7 → "proximo"

3. Obtener usuarios a notificar:
   ├── Responsables del proceso (ProcesoResponsable)
   └── Si no hay → Supervisores/Gerentes generales

4. Crear alertas:
   ├── Verificar si ya existe alerta reciente (24h)
   ├── Si existe → Actualizar diasRestantes
   └── Si no existe → Crear nueva alerta

5. Limpieza:
   └── Eliminar alertas leídas > 30 días
```

### Ejemplo de Cálculo

```typescript
// Plan con fecha estimada: 2026-03-25
// Fecha actual: 2026-03-22

const fechaEstimada = new Date('2026-03-25');
const hoy = new Date('2026-03-22');
const diasRestantes = Math.ceil((fechaEstimada - hoy) / (1000 * 60 * 60 * 24));
// diasRestantes = 3

// Resultado: Alerta tipo "proximo" (3 días restantes)
```

---

## 🎯 Destinatarios de Alertas

### Prioridad 1: Responsables del Proceso

```typescript
// Busca en ProcesoResponsable
const responsables = causa.riesgo.proceso.responsables;
// Notifica a todos los responsables del proceso
```

### Prioridad 2: Supervisores Generales

Si no hay responsables específicos:

```typescript
// Busca usuarios con roles supervisor o gerente
const supervisores = await prisma.usuario.findMany({
  where: {
    role: {
      codigo: { in: ['supervisor', 'gerente'] }
    },
    activo: true
  }
});
```

---

## 🛡️ Prevención de Duplicados

### Estrategia

```typescript
// Busca alertas similares en las últimas 24 horas
const alertaExistente = await prisma.alertaVencimiento.findFirst({
  where: {
    causaRiesgoId: causa.id,
    usuarioId,
    tipo: tipoAlerta,
    fechaGeneracion: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
  }
});

if (alertaExistente) {
  // Actualizar días restantes en lugar de crear nueva
  await prisma.alertaVencimiento.update({
    where: { id: alertaExistente.id },
    data: { diasRestantes }
  });
}
```

### Beneficios

- ✅ Evita spam de notificaciones
- ✅ Mantiene información actualizada
- ✅ Reduce carga en la base de datos

---

## 🧪 Testing

### Test Manual Completo

1. **Preparar datos de prueba:**
```sql
-- Crear una causa con plan próximo a vencer
UPDATE "CausaRiesgo"
SET gestion = jsonb_set(
  COALESCE(gestion, '{}'::jsonb),
  '{planFechaEstimada}',
  to_jsonb((CURRENT_DATE + INTERVAL '3 days')::text)
)
WHERE id = 259;

-- Asegurar que tiene estado activo
UPDATE "CausaRiesgo"
SET gestion = jsonb_set(
  gestion,
  '{planEstado}',
  '"en_progreso"'
)
WHERE id = 259;
```

2. **Ejecutar cron manualmente:**
```bash
curl -X POST http://localhost:8080/api/cron/ejecutar-alertas \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

3. **Verificar alertas generadas:**
```bash
curl -X GET http://localhost:8080/api/planes-accion/alertas-vencimiento \
  -H "Authorization: Bearer USER_TOKEN"
```

4. **Verificar en base de datos:**
```sql
SELECT * FROM "AlertaVencimiento"
WHERE "causaRiesgoId" = 259
ORDER BY "fechaGeneracion" DESC;
```

### Casos de Prueba

| Caso | Fecha Estimada | Estado Plan | Resultado Esperado |
|------|----------------|-------------|-------------------|
| 1 | Hoy + 3 días | en_progreso | Alerta "proximo" |
| 2 | Hoy - 2 días | en_progreso | Alerta "vencido" |
| 3 | Hoy + 10 días | en_progreso | Sin alerta |
| 4 | Hoy + 3 días | completado | Sin alerta |
| 5 | Hoy + 3 días | cancelado | Sin alerta |

---

## 🐛 Troubleshooting

### Problema: El cron no se ejecuta

**Síntomas:**
- No aparecen logs de `[CRON]`
- No se generan alertas

**Solución:**
1. Verificar que el servidor inició correctamente
2. Revisar logs de inicio:
```bash
npm run dev
# Buscar: "[CRON] Servicio de cron jobs iniciado correctamente"
```

3. Verificar estado:
```bash
curl http://localhost:8080/api/cron/estado \
  -H "Authorization: Bearer TOKEN"
```

### Problema: Se generan alertas duplicadas

**Síntomas:**
- Múltiples alertas para el mismo plan y usuario

**Solución:**
1. Verificar la lógica de prevención de duplicados
2. Revisar logs para ver si hay errores
3. Limpiar alertas duplicadas:
```sql
DELETE FROM "AlertaVencimiento" a
USING "AlertaVencimiento" b
WHERE a.id > b.id
  AND a."causaRiesgoId" = b."causaRiesgoId"
  AND a."usuarioId" = b."usuarioId"
  AND a.tipo = b.tipo
  AND a."fechaGeneracion"::date = b."fechaGeneracion"::date;
```

### Problema: No se notifica a nadie

**Síntomas:**
- El cron se ejecuta pero no crea alertas

**Solución:**
1. Verificar que los procesos tienen responsables:
```sql
SELECT p.id, p.nombre, COUNT(pr.id) as responsables
FROM "Proceso" p
LEFT JOIN "ProcesoResponsable" pr ON p.id = pr."procesoId"
GROUP BY p.id, p.nombre
HAVING COUNT(pr.id) = 0;
```

2. Verificar que existen supervisores:
```sql
SELECT u.id, u.nombre, u.email, r.codigo
FROM "Usuario" u
JOIN "Role" r ON u."roleId" = r.id
WHERE r.codigo IN ('supervisor', 'gerente')
  AND u.activo = true;
```

### Problema: Alertas no se limpian

**Síntomas:**
- Alertas antiguas siguen en la base de datos

**Solución:**
1. Verificar que las alertas están marcadas como leídas:
```sql
SELECT COUNT(*) FROM "AlertaVencimiento"
WHERE leida = true
  AND "fechaLectura" < NOW() - INTERVAL '30 days';
```

2. Ejecutar limpieza manual:
```sql
DELETE FROM "AlertaVencimiento"
WHERE leida = true
  AND "fechaLectura" < NOW() - INTERVAL '30 days';
```

---

## 📈 Métricas y Estadísticas

### Consultas Útiles

**Alertas por tipo:**
```sql
SELECT tipo, COUNT(*) as total
FROM "AlertaVencimiento"
GROUP BY tipo;
```

**Alertas por usuario:**
```sql
SELECT u.nombre, u.email, COUNT(a.id) as alertas_pendientes
FROM "Usuario" u
JOIN "AlertaVencimiento" a ON u.id = a."usuarioId"
WHERE a.leida = false
GROUP BY u.id, u.nombre, u.email
ORDER BY alertas_pendientes DESC;
```

**Planes más críticos:**
```sql
SELECT 
  cr.id,
  cr.descripcion,
  cr.gestion->>'planFechaEstimada' as fecha_estimada,
  COUNT(a.id) as alertas_generadas
FROM "CausaRiesgo" cr
JOIN "AlertaVencimiento" a ON cr.id = a."causaRiesgoId"
WHERE a.tipo = 'vencido'
GROUP BY cr.id, cr.descripcion, cr.gestion
ORDER BY alertas_generadas DESC
LIMIT 10;
```

---

## 🔄 Integración con Frontend

Las alertas generadas por el cron se consumen en el frontend a través de:

1. **Endpoint de alertas:**
```typescript
GET /api/planes-accion/alertas-vencimiento?soloNoLeidas=true
```

2. **Componente NotificationsMenu:**
```typescript
// Muestra badge con número de alertas no leídas
// Permite marcar como leídas
```

3. **Componente AlertasVencimientoPanel:**
```typescript
// Muestra lista completa de alertas
// Filtra por tipo (vencido, próximo)
// Permite navegar al plan
```

---

## 🎯 Próximos Pasos

- [ ] Agregar notificaciones por email
- [ ] Agregar notificaciones push
- [ ] Configurar múltiples horarios de ejecución
- [ ] Dashboard de métricas de alertas
- [ ] Exportar reportes de alertas
- [ ] Configuración personalizada por usuario

---

## ✅ Checklist de Implementación

- [x] Servicio de generación de alertas
- [x] Servicio de cron jobs
- [x] Inicialización automática
- [x] Endpoints de gestión
- [x] Prevención de duplicados
- [x] Limpieza automática
- [x] Logs detallados
- [x] Documentación completa
- [x] Compilación exitosa

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs del servidor
2. Verifica el estado del cron: `GET /api/cron/estado`
3. Ejecuta manualmente: `POST /api/cron/ejecutar-alertas`
4. Revisa esta documentación
5. Consulta `docs/API_PLAN_TRAZABILIDAD.md` para endpoints de alertas

---

## 🎉 Conclusión

El sistema de cron jobs está completamente implementado y funcional. Se ejecuta automáticamente cada día a las 08:00 AM, genera alertas para planes próximos a vencer o vencidos, y notifica a los responsables correspondientes.

**Estado**: ✅ Fase 3 Completada
