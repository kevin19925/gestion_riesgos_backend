# 🚀 Guía Rápida: Sistema de Trazabilidad de Planes de Acción

## 📋 Resumen del Sistema

Sistema completo para gestionar la trazabilidad y evolución de planes de acción, incluyendo:
- ✅ Cambio de estados
- ✅ Conversión a controles
- ✅ Alertas automáticas de vencimiento
- ✅ Historial completo de trazabilidad

---

## 🎯 Endpoints Principales

### 1. Cambiar Estado del Plan
```bash
PUT /api/causas/:id/plan/estado
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "estado": "en_progreso",
  "observacion": "Iniciando implementación"
}
```

**Estados válidos**: `pendiente`, `en_progreso`, `completado`, `cancelado`

---

### 2. Convertir Plan a Control
```bash
POST /api/causas/:id/plan/convertir-a-control
Content-Type: application/json
Authorization: Bearer TOKEN

{
  "tipoControl": "prevención",
  "observaciones": "Plan exitoso"
}
```

**Tipos válidos**: `prevención`, `detección`, `corrección`

**Requisitos**:
- Plan debe estar en estado `completado`
- No debe haber sido convertido previamente

---

### 3. Obtener Trazabilidad
```bash
GET /api/causas/:id/plan/trazabilidad
Authorization: Bearer TOKEN
```

**Retorna**:
- Información del plan
- Historial de estados
- Control derivado (si existe)
- Eventos de auditoría

---

### 4. Obtener Alertas de Vencimiento
```bash
GET /api/planes-accion/alertas-vencimiento?soloNoLeidas=true
Authorization: Bearer TOKEN
```

**Retorna**:
- Lista de alertas del usuario
- Estadísticas (total, no leídas, vencidas, próximas)

---

### 5. Marcar Alerta como Leída
```bash
PUT /api/alertas/:id/marcar-leida
Authorization: Bearer TOKEN
```

---

### 6. Estado del Cron Job
```bash
GET /api/cron/estado
Authorization: Bearer TOKEN
```

**Retorna**:
- Estado del cron (activo, última ejecución, próxima)
- Estadísticas de alertas

---

### 7. Ejecutar Alertas Manualmente
```bash
POST /api/cron/ejecutar-alertas
Authorization: Bearer ADMIN_TOKEN
```

**Requisito**: Solo usuarios con rol `admin`

---

## 🗄️ Estructura de Datos

### CausaRiesgo.gestion (JSON)
```json
{
  "planDescripcion": "Descripción del plan",
  "planResponsable": "Nombre del responsable",
  "planFechaEstimada": "2026-03-30",
  "planEstado": "en_progreso",
  "planDetalle": "Detalles adicionales",
  "planDecision": "Decisión tomada",
  
  // Campos de trazabilidad (agregados por API)
  "controlDerivadoId": 123,
  "fechaConversion": "2026-03-15T10:00:00Z",
  "observacionesConversion": "Plan exitoso",
  "historialEstados": [
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
```

### Tabla AlertaVencimiento
```sql
CREATE TABLE "AlertaVencimiento" (
  id SERIAL PRIMARY KEY,
  "causaRiesgoId" INTEGER NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL,        -- "proximo" | "vencido"
  "diasRestantes" INTEGER,
  leida BOOLEAN DEFAULT false,
  "fechaGeneracion" TIMESTAMP DEFAULT NOW(),
  "fechaLectura" TIMESTAMP
);
```

### Tabla Control (campos agregados)
```sql
ALTER TABLE "Control" 
ADD COLUMN "causaRiesgoOrigenId" INTEGER,
ADD COLUMN "fechaCreacionDesdePlan" TIMESTAMP;
```

---

## 🕐 Cron Job

### Configuración
- **Frecuencia**: Diaria
- **Hora**: 08:00 AM
- **Función**: Genera alertas automáticas

### Lógica
1. Busca causas con planes activos
2. Calcula días restantes hasta fecha estimada
3. Genera alertas:
   - **Próximo**: 0-7 días restantes
   - **Vencido**: Fecha pasada
4. Notifica a responsables del proceso
5. Limpia alertas leídas > 30 días

### Inicio Automático
```typescript
// En src/index.ts
import { iniciarCronJobs } from './services/cron.service';

server.listen(port, () => {
  iniciarCronJobs(); // ← Se inicia automáticamente
});
```

---

## 🧪 Testing Rápido

### 1. Verificar que el servidor está corriendo
```bash
curl http://localhost:8080/api/health
```

### 2. Verificar estado del cron
```bash
curl http://localhost:8080/api/cron/estado \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Ejecutar cron manualmente (como admin)
```bash
curl -X POST http://localhost:8080/api/cron/ejecutar-alertas \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 4. Ver alertas generadas
```bash
curl http://localhost:8080/api/planes-accion/alertas-vencimiento \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Cambiar estado de un plan
```bash
curl -X PUT http://localhost:8080/api/causas/259/plan/estado \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"estado": "en_progreso", "observacion": "Iniciando"}'
```

### 6. Convertir plan a control
```bash
curl -X POST http://localhost:8080/api/causas/259/plan/convertir-a-control \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tipoControl": "prevención", "observaciones": "Plan exitoso"}'
```

---

## 📊 Consultas SQL Útiles

### Ver planes activos
```sql
SELECT 
  cr.id,
  cr.descripcion,
  cr.gestion->>'planDescripcion' as plan,
  cr.gestion->>'planFechaEstimada' as fecha,
  cr.gestion->>'planEstado' as estado
FROM "CausaRiesgo" cr
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
  AND cr.gestion IS NOT NULL
  AND cr.gestion->>'planEstado' IN ('pendiente', 'en_progreso');
```

### Ver alertas por usuario
```sql
SELECT 
  u.nombre,
  u.email,
  a.tipo,
  a."diasRestantes",
  a.leida,
  cr.gestion->>'planDescripcion' as plan
FROM "AlertaVencimiento" a
JOIN "Usuario" u ON a."usuarioId" = u.id
JOIN "CausaRiesgo" cr ON a."causaRiesgoId" = cr.id
WHERE u.id = 5
ORDER BY a."fechaGeneracion" DESC;
```

### Ver controles derivados de planes
```sql
SELECT 
  c.id as control_id,
  c.descripcion as control,
  c."tipoControl",
  cr.id as causa_id,
  cr.gestion->>'planDescripcion' as plan_origen,
  c."fechaCreacionDesdePlan"
FROM "Control" c
JOIN "CausaRiesgo" cr ON c."causaRiesgoOrigenId" = cr.id
WHERE c."causaRiesgoOrigenId" IS NOT NULL;
```

### Estadísticas de alertas
```sql
SELECT 
  tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE leida = false) as no_leidas,
  COUNT(*) FILTER (WHERE leida = true) as leidas
FROM "AlertaVencimiento"
GROUP BY tipo;
```

---

## 🐛 Troubleshooting Rápido

### Problema: No se generan alertas

**Verificar:**
```sql
-- ¿Hay planes activos próximos a vencer?
SELECT COUNT(*) FROM "CausaRiesgo"
WHERE "tipoGestion" IN ('PLAN', 'AMBOS')
  AND gestion->>'planEstado' IN ('pendiente', 'en_progreso')
  AND (gestion->>'planFechaEstimada')::date <= CURRENT_DATE + INTERVAL '7 days';
```

**Solución:**
- Crear planes de prueba con fechas próximas
- Ejecutar cron manualmente

---

### Problema: Cron no se ejecuta

**Verificar logs:**
```bash
npm run dev
# Buscar: "[CRON] Servicio de cron jobs iniciado correctamente"
```

**Verificar estado:**
```bash
curl http://localhost:8080/api/cron/estado \
  -H "Authorization: Bearer TOKEN"
```

---

### Problema: Error al convertir plan

**Verificar:**
```sql
-- ¿El plan está completado?
SELECT 
  id,
  gestion->>'planEstado' as estado,
  gestion->>'controlDerivadoId' as ya_convertido
FROM "CausaRiesgo"
WHERE id = 259;
```

**Requisitos:**
- Estado debe ser `completado`
- No debe tener `controlDerivadoId`

---

## 📁 Archivos Importantes

### Backend
```
gestion_riesgos_backend/
├── src/
│   ├── services/
│   │   ├── alertas-vencimiento.service.ts  ← Generación de alertas
│   │   └── cron.service.ts                 ← Gestión del cron
│   ├── controllers/
│   │   ├── plan-trazabilidad.controller.ts ← Endpoints de planes
│   │   └── cron.controller.ts              ← Endpoints de cron
│   └── routes/
│       ├── plan-trazabilidad.routes.ts     ← Rutas de planes
│       └── cron.routes.ts                  ← Rutas de cron
├── docs/
│   ├── API_PLAN_TRAZABILIDAD.md            ← API completa
│   └── CRON_ALERTAS.md                     ← Documentación del cron
├── migrations/
│   └── add_trazabilidad_causariesgo.sql    ← Migración aplicada
├── FASE2_COMPLETADA.md                     ← Resumen Fase 2
└── FASE3_COMPLETADA.md                     ← Resumen Fase 3
```

### Frontend (Mock Data - Fase 4 pendiente)
```
gestion-riesgos-app/
├── src/
│   ├── types/
│   │   └── planAccion.types.ts             ← Interfaces TypeScript
│   ├── mocks/
│   │   └── planAccionMocks.ts              ← Datos de prueba
│   ├── components/plan-accion/
│   │   ├── EstadoPlanSelector.tsx          ← Selector de estado
│   │   ├── PlanAccionCard.tsx              ← Card del plan
│   │   ├── ConversionDialog.tsx            ← Diálogo conversión
│   │   ├── AlertasVencimientoPanel.tsx     ← Panel de alertas
│   │   ├── TrazabilidadTimeline.tsx        ← Timeline de historial
│   │   └── DeleteControlDialog.tsx         ← Diálogo eliminación
│   └── pages/planes/
│       └── PlanesAccionPage.tsx            ← Página principal
```

---

## 🎯 Estado del Proyecto

| Fase | Estado | Progreso |
|------|--------|----------|
| Fase 1: Base de Datos | ✅ Completada | 100% |
| Fase 2: Endpoints API | ✅ Completada | 100% |
| Fase 3: Cron Job | ✅ Completada | 100% |
| Fase 4: Frontend | ⏭️ Pendiente | 0% |
| Fase 5: Testing | ⏭️ Pendiente | 0% |

**Progreso Total**: 60% (3 de 5 fases)

---

## 📞 Documentación Completa

- **API Trazabilidad**: `docs/API_PLAN_TRAZABILIDAD.md`
- **Cron Jobs**: `docs/CRON_ALERTAS.md`
- **Fase 2**: `FASE2_COMPLETADA.md`
- **Fase 3**: `FASE3_COMPLETADA.md`
- **Esta guía**: `GUIA_RAPIDA_TRAZABILIDAD.md`

---

## 🎉 Próximos Pasos

### Fase 4: Integración Frontend
1. Crear hooks RTK Query
2. Conectar componentes a API real
3. Reemplazar mock data
4. Implementar notificaciones
5. Testing E2E

### Fase 5: Despliegue
1. Tests en desarrollo
2. Aplicar en producción
3. Monitorear logs
4. Soporte a usuarios

---

**Última actualización**: 22 de marzo de 2026
