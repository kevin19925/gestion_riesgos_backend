# 📋 API de Trazabilidad de Planes de Acción

## 🎯 Descripción

Esta API gestiona la trazabilidad y evolución de planes de acción que están almacenados en `CausaRiesgo.gestion` (JSON).

**Base URL**: `/api`

**Autenticación**: Todas las rutas requieren token JWT en el header `Authorization: Bearer <token>`

---

## 📍 Endpoints

### 1. Cambiar Estado del Plan

Actualiza el estado de un plan de acción y registra el cambio en el historial.

**Endpoint**: `PUT /api/causas/:id/plan/estado`

**Parámetros URL**:
- `id` (number): ID de la causa que contiene el plan

**Body**:
```json
{
  "estado": "en_progreso",
  "observacion": "Iniciando implementación del plan"
}
```

**Estados válidos**:
- `pendiente`
- `en_progreso`
- `completado`
- `cancelado`

**Respuesta exitosa** (200):
```json
{
  "success": true,
  "causa": { /* objeto causa actualizado */ },
  "estadoAnterior": "pendiente",
  "estadoNuevo": "en_progreso"
}
```

**Errores**:
- `400`: Estado inválido o causa sin plan
- `404`: Causa no encontrada
- `500`: Error del servidor

---

### 2. Convertir Plan a Control

Convierte un plan de acción completado en un control permanente.

**Endpoint**: `POST /api/causas/:id/plan/convertir-a-control`

**Parámetros URL**:
- `id` (number): ID de la causa que contiene el plan

**Body**:
```json
{
  "tipoControl": "prevención",
  "observaciones": "Plan exitoso, se convierte en control permanente"
}
```

**Tipos de control válidos**:
- `prevención`
- `detección`
- `corrección`

**Respuesta exitosa** (201):
```json
{
  "success": true,
  "control": {
    "id": 123,
    "riesgoId": 146,
    "descripcion": "La Contadora creará y socializará...",
    "tipoControl": "prevención",
    "efectividad": 0.75,
    "causaRiesgoOrigenId": 259,
    "fechaCreacionDesdePlan": "2026-03-22T10:30:00Z"
  },
  "causa": { /* objeto causa actualizado */ },
  "message": "Plan convertido exitosamente a control"
}
```

**Errores**:
- `400`: Plan no completado, ya convertido, o tipo de control inválido
- `404`: Causa no encontrada
- `500`: Error del servidor

**Validaciones**:
- ✅ El plan debe estar en estado `completado`
- ✅ No debe haber sido convertido previamente
- ✅ La causa debe tener un riesgo asociado

---

### 3. Obtener Trazabilidad del Plan

Obtiene el historial completo de un plan: estados, eventos, control derivado.

**Endpoint**: `GET /api/causas/:id/plan/trazabilidad`

**Parámetros URL**:
- `id` (number): ID de la causa que contiene el plan

**Respuesta exitosa** (200):
```json
{
  "causa": {
    "id": 259,
    "descripcion": "Falta de definición acerca de la forma...",
    "tipoGestion": "PLAN",
    "riesgo": {
      "id": 146,
      "numeroIdentificacion": "3GAD",
      "descripcion": "La posibilidad de fuga, pérdida...",
      "proceso": "Gestión de Adquisiciones"
    }
  },
  "plan": {
    "descripcion": "La Contadora creará y socializará...",
    "responsable": "Contadora",
    "fechaEstimada": "2026-02-28",
    "estado": "completado",
    "detalle": "Detalles del plan...",
    "decision": "Decisión tomada..."
  },
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
    },
    {
      "estado": "completado",
      "fecha": "2026-02-28T16:00:00Z",
      "usuario": "Juan Pérez",
      "observacion": "Plan completado exitosamente"
    }
  ],
  "controlDerivado": {
    "id": 123,
    "descripcion": "La Contadora creará y socializará...",
    "tipoControl": "prevención",
    "efectividad": 0.75,
    "fechaCreacion": "2026-03-01T10:00:00Z"
  },
  "eventos": [
    {
      "fecha": "2026-03-01T10:00:00Z",
      "usuario": "Juan Pérez",
      "accion": "CREATE",
      "descripcion": "Plan convertido a control (ID: 123)",
      "valorAnterior": null,
      "valorNuevo": "completado"
    }
  ]
}
```

**Errores**:
- `404`: Causa no encontrada
- `500`: Error del servidor

---

### 4. Obtener Alertas de Vencimiento

Obtiene las alertas de vencimiento de planes para el usuario autenticado.

**Endpoint**: `GET /api/planes-accion/alertas-vencimiento`

**Query Parameters**:
- `soloNoLeidas` (boolean, opcional): Si es `true`, solo retorna alertas no leídas

**Ejemplo**: `GET /api/planes-accion/alertas-vencimiento?soloNoLeidas=true`

**Respuesta exitosa** (200):
```json
{
  "alertas": [
    {
      "id": 1,
      "tipo": "vencido",
      "diasRestantes": -5,
      "leida": false,
      "fechaGeneracion": "2026-03-22T08:00:00Z",
      "plan": {
        "causaId": 259,
        "descripcion": "La Contadora creará y socializará...",
        "responsable": "Contadora",
        "fechaEstimada": "2026-03-17",
        "estado": "en_progreso"
      },
      "riesgo": {
        "id": 146,
        "numeroIdentificacion": "3GAD",
        "descripcion": "La posibilidad de fuga, pérdida..."
      },
      "proceso": {
        "id": 5,
        "nombre": "Gestión de Adquisiciones"
      }
    },
    {
      "id": 2,
      "tipo": "proximo",
      "diasRestantes": 3,
      "leida": false,
      "fechaGeneracion": "2026-03-22T08:00:00Z",
      "plan": {
        "causaId": 260,
        "descripcion": "Implementar política de seguridad...",
        "responsable": "Jefe de TI",
        "fechaEstimada": "2026-03-25",
        "estado": "en_progreso"
      },
      "riesgo": {
        "id": 147,
        "numeroIdentificacion": "4TEC",
        "descripcion": "Riesgo tecnológico..."
      },
      "proceso": {
        "id": 8,
        "nombre": "Tecnología"
      }
    }
  ],
  "total": 2,
  "proximasAVencer": 1,
  "vencidas": 1,
  "noLeidas": 2
}
```

**Errores**:
- `401`: Usuario no autenticado
- `500`: Error del servidor

---

### 5. Marcar Alerta como Leída

Marca una alerta de vencimiento como leída.

**Endpoint**: `PUT /api/alertas/:id/marcar-leida`

**Parámetros URL**:
- `id` (number): ID de la alerta

**Respuesta exitosa** (200):
```json
{
  "success": true,
  "alerta": {
    "id": 1,
    "causaRiesgoId": 259,
    "usuarioId": 5,
    "tipo": "vencido",
    "diasRestantes": -5,
    "leida": true,
    "fechaGeneracion": "2026-03-22T08:00:00Z",
    "fechaLectura": "2026-03-22T14:30:00Z"
  }
}
```

**Errores**:
- `401`: Usuario no autenticado
- `403`: La alerta no pertenece al usuario
- `404`: Alerta no encontrada
- `500`: Error del servidor

---

## 🔐 Autenticación

Todas las rutas requieren un token JWT válido en el header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

El token debe contener:
- `id`: ID del usuario
- `email`: Email del usuario
- `nombre`: Nombre del usuario
- `role`: Rol del usuario

---

## 📊 Estructura de Datos

### CausaRiesgo.gestion (JSON)

```typescript
{
  // Campos existentes
  planDescripcion: string;
  planResponsable: string;
  planFechaEstimada: string; // ISO 8601
  planEstado: 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';
  planDetalle?: string;
  planDecision?: string;
  planEvidencia?: string;
  
  // Campos de trazabilidad (agregados por la API)
  controlDerivadoId?: number;
  fechaConversion?: string; // ISO 8601
  observacionesConversion?: string;
  historialEstados?: Array<{
    estado: string;
    fecha: string; // ISO 8601
    usuario: string;
    observacion: string;
  }>;
}
```

---

## 🧪 Ejemplos de Uso

### Ejemplo 1: Cambiar estado de un plan

```bash
curl -X PUT http://localhost:8080/api/causas/259/plan/estado \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estado": "en_progreso",
    "observacion": "Iniciando implementación"
  }'
```

### Ejemplo 2: Convertir plan a control

```bash
curl -X POST http://localhost:8080/api/causas/259/plan/convertir-a-control \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tipoControl": "prevención",
    "observaciones": "Plan exitoso"
  }'
```

### Ejemplo 3: Obtener alertas no leídas

```bash
curl -X GET "http://localhost:8080/api/planes-accion/alertas-vencimiento?soloNoLeidas=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ejemplo 4: Marcar alerta como leída

```bash
curl -X PUT http://localhost:8080/api/alertas/1/marcar-leida \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Notas Importantes

1. **Planes en JSON**: Los planes están almacenados en `CausaRiesgo.gestion` como JSON, no en la tabla `PlanAccion`.

2. **Historial de Estados**: Cada cambio de estado se registra en `gestion.historialEstados` y en `HistorialEvento`.

3. **Conversión a Control**: Solo planes con estado `completado` pueden convertirse en controles.

4. **Alertas**: Las alertas se generan automáticamente por un cron job (ver documentación del cron).

5. **Trazabilidad Bidireccional**: 
   - `CausaRiesgo.gestion.controlDerivadoId` → ID del control creado
   - `Control.causaRiesgoOrigenId` → ID de la causa origen

---

## 🐛 Debugging

Para ver logs detallados en desarrollo:

```bash
# En el backend
npm run dev

# Los logs mostrarán:
# - Errores de validación
# - Queries a la base de datos
# - Eventos registrados en historial
```

---

## 🔄 Próximos Pasos

- [ ] Implementar cron job para generar alertas automáticamente
- [ ] Agregar notificaciones push/email para alertas
- [ ] Implementar filtros avanzados en alertas
- [ ] Agregar exportación de trazabilidad a PDF

