# Guía de Pruebas - Migración de Normalización

## 🧪 Pruebas Recomendadas

### Preparación

1. **Iniciar el servidor**:
```bash
cd gestion_riesgos_backend
npm run dev
```

2. **Verificar que el servidor está corriendo**:
```bash
# Debería mostrar: "Servidor corriendo en puerto 3000"
```

---

## 1. Pruebas de Tipologías Extendidas (NUEVO)

### 1.1 Listar Tipologías
```bash
GET http://localhost:3000/api/catalogos/tipologias-extendidas
```

**Resultado esperado**: Lista de tipologías nivel 3 y 4

### 1.2 Crear Tipología Nivel 3
```bash
POST http://localhost:3000/api/catalogos/tipologias-extendidas
Content-Type: application/json

{
  "nivel": 3,
  "nombre": "Tipología Test Nivel 3",
  "descripcion": "Descripción de prueba",
  "activo": true
}
```

**Resultado esperado**: Tipología creada con ID

### 1.3 Crear Tipología Nivel 4
```bash
POST http://localhost:3000/api/catalogos/tipologias-extendidas
Content-Type: application/json

{
  "nivel": 4,
  "nombre": "Tipología Test Nivel 4",
  "descripcion": "Descripción de prueba",
  "activo": true
}
```

**Resultado esperado**: Tipología creada con ID

### 1.4 Intentar Crear Tipología con Nivel Inválido
```bash
POST http://localhost:3000/api/catalogos/tipologias-extendidas
Content-Type: application/json

{
  "nivel": 5,
  "nombre": "Tipología Inválida",
  "descripcion": "Esto debería fallar"
}
```

**Resultado esperado**: Error 400 - "El nivel debe ser 3 o 4"

---

## 2. Pruebas de Planes de Acción

### 2.1 Listar Planes
```bash
GET http://localhost:3000/api/planes-accion
```

**Resultado esperado**: Lista de planes desde tabla `PlanAccion`

### 2.2 Cambiar Estado de un Plan
```bash
PUT http://localhost:3000/api/causas/{causaId}/plan/estado
Content-Type: application/json

{
  "estado": "EN_REVISION",
  "observacion": "Revisión inicial del plan"
}
```

**Resultado esperado**: 
- Estado actualizado en `PlanAccion`
- Entrada creada en `HistorialEstadoPlan`
- Evento registrado en `HistorialEvento`

### 2.3 Obtener Trazabilidad de un Plan (REFACTORIZADO)
```bash
GET http://localhost:3000/api/causas/{causaId}/plan/trazabilidad
```

**Resultado esperado**:
```json
{
  "causa": { ... },
  "plan": {
    "id": 1,
    "descripcion": "...",
    "estado": "...",
    ...
  },
  "historialEstados": [
    {
      "estado": "EN_REVISION",
      "responsable": "Usuario",
      "fechaEstado": "2024-01-01T00:00:00Z",
      ...
    }
  ],
  "controlDerivado": null,
  "eventos": [ ... ]
}
```

### 2.4 Convertir Plan a Control (REFACTORIZADO)

**Paso 1**: Cambiar estado del plan a COMPLETADO
```bash
PUT http://localhost:3000/api/causas/{causaId}/plan/estado
Content-Type: application/json

{
  "estado": "COMPLETADO",
  "observacion": "Plan completado exitosamente"
}
```

**Paso 2**: Convertir a control
```bash
POST http://localhost:3000/api/causas/{causaId}/plan/convertir-a-control
Content-Type: application/json

{
  "tipoControl": "prevención",
  "observaciones": "Control derivado de plan exitoso"
}
```

**Resultado esperado**:
- Control creado en tabla `ControlRiesgo`
- Entrada en `HistorialEstadoPlan` con estado `CONVERTIDO_A_CONTROL`
- Observaciones del plan actualizadas
- Evento registrado

**Paso 3**: Verificar que no se puede convertir dos veces
```bash
POST http://localhost:3000/api/causas/{causaId}/plan/convertir-a-control
Content-Type: application/json

{
  "tipoControl": "prevención",
  "observaciones": "Segundo intento"
}
```

**Resultado esperado**: Error 400 - "Este plan ya fue convertido a control previamente"

---

## 3. Pruebas de Alertas de Vencimiento

### 3.1 Obtener Alertas del Usuario
```bash
GET http://localhost:3000/api/planes-accion/alertas-vencimiento
Authorization: Bearer {token}
```

**Resultado esperado**: Lista de alertas con información de planes desde tabla `PlanAccion`

### 3.2 Marcar Alerta como Leída
```bash
PUT http://localhost:3000/api/alertas/{alertaId}/marcar-leida
Authorization: Bearer {token}
```

**Resultado esperado**: Alerta marcada como leída

---

## 4. Pruebas de Riesgos con Tipologías

### 4.1 Crear Riesgo con Tipologías 3 y 4
```bash
POST http://localhost:3000/api/riesgos
Content-Type: application/json

{
  "procesoId": 1,
  "descripcion": "Riesgo de prueba",
  "tipologiaTipo1Id": 1,
  "tipologiaTipo2Id": 1,
  "tipologiaTipo3Id": 1,
  "tipologiaTipo4Id": 1
}
```

**Resultado esperado**: Riesgo creado con tipologías por ID

### 4.2 Listar Riesgos
```bash
GET http://localhost:3000/api/riesgos
```

**Resultado esperado**: Lista de riesgos con relaciones `tipologiaTipo3Relacion` y `tipologiaTipo4Relacion`

---

## 5. Pruebas de Recálculo Residual

### 5.1 Crear Control en una Causa
```bash
POST http://localhost:3000/api/causas/{causaId}/controles
Content-Type: application/json

{
  "descripcion": "Control de prueba",
  "tipoControl": "prevención",
  "aplicabilidad": 3,
  "cobertura": 3,
  "facilidadUso": 3,
  "segregacion": 3,
  "naturaleza": 1,
  "desviaciones": 0
}
```

**Resultado esperado**: 
- Control creado en `ControlRiesgo`
- Recálculo residual ejecutado
- Campos actualizados en `ControlRiesgo` y `EvaluacionRiesgo`

---

## 6. Verificaciones en Base de Datos

### 6.1 Verificar que los datos se guardan correctamente

```sql
-- Verificar planes en tabla PlanAccion
SELECT * FROM "PlanAccion" WHERE "causaRiesgoId" = {causaId};

-- Verificar historial de estados
SELECT * FROM "HistorialEstadoPlan" WHERE "causaRiesgoId" = {causaId} ORDER BY "fechaEstado" DESC;

-- Verificar controles
SELECT * FROM "ControlRiesgo" WHERE "causaRiesgoId" = {causaId};

-- Verificar tipologías extendidas
SELECT * FROM "TipologiaRiesgoExtendida" ORDER BY "nivel", "nombre";

-- Verificar riesgos con tipologías
SELECT r.id, r.descripcion, 
       t3.nombre as tipologia3, 
       t4.nombre as tipologia4
FROM "Riesgo" r
LEFT JOIN "TipologiaRiesgoExtendida" t3 ON r."tipologiaTipo3Id" = t3.id
LEFT JOIN "TipologiaRiesgoExtendida" t4 ON r."tipologiaTipo4Id" = t4.id;
```

---

## 7. Monitoreo de Logs

### 7.1 Buscar Errores
```bash
# En la consola del servidor, buscar:
- "Error al..."
- "undefined"
- "null"
- "gestion"
- "tipoGestion"
```

### 7.2 Verificar Logs de Éxito
```bash
# Buscar mensajes como:
- "✅ Estado actualizado"
- "✅ Planes encontrados"
- "✅ Control creado"
```

---

## 8. Pruebas de Regresión

### 8.1 Funcionalidades Existentes
- ✅ Crear y editar causas
- ✅ Crear y editar riesgos
- ✅ Listar riesgos con filtros
- ✅ Dashboard y reportes
- ✅ Autenticación y autorización
- ✅ Historial de eventos

---

## ⚠️ Problemas Comunes y Soluciones

### Problema: "Cannot read property 'gestion' of undefined"
**Solución**: Verificar que el código no está usando campos obsoletos

### Problema: "Column 'gestion' does not exist"
**Solución**: Regenerar cliente de Prisma: `npx prisma generate`

### Problema: "Foreign key constraint failed"
**Solución**: Verificar que los IDs de tipologías existen en la tabla

### Problema: "Estado inválido"
**Solución**: Usar estados válidos: EN_REVISION, REVISADO, PENDIENTE, EN_PROGRESO, COMPLETADO

---

## ✅ Checklist de Pruebas

- [ ] Tipologías extendidas - Listar
- [ ] Tipologías extendidas - Crear nivel 3
- [ ] Tipologías extendidas - Crear nivel 4
- [ ] Tipologías extendidas - Validación de nivel
- [ ] Planes - Listar
- [ ] Planes - Cambiar estado
- [ ] Planes - Obtener trazabilidad
- [ ] Planes - Convertir a control
- [ ] Planes - Validar conversión única
- [ ] Alertas - Listar
- [ ] Alertas - Marcar como leída
- [ ] Riesgos - Crear con tipologías
- [ ] Riesgos - Listar con relaciones
- [ ] Controles - Crear y recalcular
- [ ] Logs - Sin errores
- [ ] Base de datos - Datos correctos

---

## 📊 Criterios de Éxito

La migración es exitosa si:
1. ✅ Todos los endpoints responden sin errores
2. ✅ Los datos se guardan en las tablas correctas
3. ✅ El historial se registra correctamente
4. ✅ No hay referencias a campos obsoletos en los logs
5. ✅ Las relaciones de Prisma funcionan correctamente
6. ✅ El recálculo residual funciona
7. ✅ Las alertas se generan correctamente

---

## 🎉 Después de Pruebas Exitosas

Si todas las pruebas pasan:
1. Hacer backup de la base de datos
2. Eliminar columnas obsoletas (ver `MIGRACION_100_COMPLETADA.md`)
3. Regenerar cliente de Prisma
4. Desplegar a producción

---

**Fecha**: $(date)
**Versión**: 1.0
