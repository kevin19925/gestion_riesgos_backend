# 📋 Plan de Migración Final - Trazabilidad de Planes de Acción

## 🎯 Situación Confirmada

### Datos Actuales:
- ✅ **Tabla `PlanAccion`**: Existe pero está VACÍA (0 registros)
- ✅ **Tabla `CausaRiesgo`**: Contiene los planes en el campo `gestion` (JSON)
- ✅ **Estructura JSON**: 
  ```json
  {
    "planDescripcion": "...",
    "planResponsable": "Contadora",
    "planFechaEstimada": "2026-02-28",
    "planDetalle": "La Contadora creará...",
    "planEstado": "pendiente",
    "tipoGestion": "PLAN" o "AMBOS"
  }
  ```

### Ejemplo Real Encontrado:
- Riesgo: 3GAD (ID 146)
- Causas con planes: 2
- Responsable: Contadora
- Fecha: 2026-02-28
- Descripción: "La Contadora creará y socializará la política contable..."

---

## 🚀 Estrategia Recomendada: ENFOQUE HÍBRIDO

### Fase 1: Aplicar Migración de Schema (AHORA)
**Objetivo**: Preparar la base de datos para la nueva funcionalidad

**Acciones**:
1. ✅ Aplicar `add_plan_trazabilidad.sql`
2. ✅ Agregar campos de trazabilidad a `PlanAccion` y `Control`
3. ✅ Crear tabla `AlertaVencimiento`
4. ✅ NO tocar datos existentes en `CausaRiesgo.gestion`

**Resultado**: Base de datos lista para trazabilidad, datos legacy intactos

---

### Fase 2: Migración de Datos (OPCIONAL - Después)
**Objetivo**: Mover planes del JSON a la tabla `PlanAccion`

**Script de Migración**:
```sql
-- Extraer planes de CausaRiesgo.gestion → PlanAccion
INSERT INTO "PlanAccion" (
  "riesgoId",
  "causaRiesgoId",
  descripcion,
  responsable,
  "fechaProgramada",
  estado,
  observaciones,
  "createdAt",
  "updatedAt"
)
SELECT 
  cr."riesgoId",
  cr.id as "causaRiesgoId",
  COALESCE(cr.gestion->>'planDescripcion', cr.gestion->>'planDetalle', 'Sin descripción'),
  cr.gestion->>'planResponsable',
  (cr.gestion->>'planFechaEstimada')::timestamp,
  COALESCE(cr.gestion->>'planEstado', 'pendiente'),
  cr.gestion->>'planDetalle',
  NOW(),
  NOW()
FROM "CausaRiesgo" cr
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
  AND cr.gestion IS NOT NULL
  AND (cr.gestion->>'planDescripcion' IS NOT NULL 
       OR cr.gestion->>'planDetalle' IS NOT NULL);
```

**Ventajas**:
- ✅ Datos centralizados en `PlanAccion`
- ✅ Queries más eficientes
- ✅ Trazabilidad completa desde el inicio

**Desventajas**:
- ⚠️ Requiere actualizar frontend para leer de ambas fuentes
- ⚠️ Riesgo de duplicación si no se maneja bien

---

### Fase 3: Implementar Endpoints API
**Objetivo**: Crear endpoints para la nueva funcionalidad

**Endpoints a Crear**:
1. `PUT /api/planes-accion/:id/estado` - Cambiar estado
2. `POST /api/planes-accion/:id/convertir-a-control` - Convertir a control
3. `GET /api/planes-accion/convertidos` - Listar convertidos
4. `GET /api/planes-accion/alertas-vencimiento` - Alertas
5. `PUT /api/planes-accion/alertas/:id/marcar-leida` - Marcar alerta leída

---

### Fase 4: Conectar Frontend
**Objetivo**: Integrar la nueva pantalla con el backend real

**Cambios en Frontend**:
1. Reemplazar mock data con llamadas API reales
2. Agregar manejo de errores
3. Implementar loading states
4. Conectar con RTK Query

---

### Fase 5: Cron Job para Alertas
**Objetivo**: Generar alertas automáticas de vencimiento

**Implementación**:
- Cron diario a las 08:00 AM
- Buscar planes próximos a vencer (7 días)
- Buscar planes vencidos
- Crear alertas para supervisores

---

## 🎯 Decisión Inmediata Requerida

### Opción A: Solo Schema (Rápido - Recomendado)
**Tiempo**: 5 minutos
**Riesgo**: Bajo
**Acción**: Aplicar `add_plan_trazabilidad.sql` ahora

**Pros**:
- ✅ Sin riesgo de perder datos
- ✅ Base de datos lista para nuevas funcionalidades
- ✅ Planes legacy siguen funcionando
- ✅ Nuevos planes usan tabla `PlanAccion`

**Contras**:
- ⚠️ Datos legacy quedan en JSON
- ⚠️ Dos fuentes de datos (temporal)

---

### Opción B: Schema + Migración de Datos (Completo)
**Tiempo**: 30-60 minutos
**Riesgo**: Medio
**Acción**: Aplicar schema + script de migración de datos

**Pros**:
- ✅ Todos los datos en `PlanAccion`
- ✅ Estructura unificada
- ✅ Trazabilidad desde el inicio

**Contras**:
- ⚠️ Requiere más tiempo
- ⚠️ Necesita actualizar frontend
- ⚠️ Riesgo de inconsistencias

---

## 💡 Mi Recomendación

### EMPEZAR CON OPCIÓN A

**Razones**:
1. ✅ Seguro y rápido
2. ✅ No afecta funcionalidad actual
3. ✅ Permite probar la nueva funcionalidad
4. ✅ Migración de datos puede hacerse después si es necesario

**Siguiente Paso**:
```bash
# En pgAdmin, ejecutar:
1. Abrir add_plan_trazabilidad.sql
2. Ejecutar (F5)
3. Verificar que funcionó
4. Listo para implementar endpoints
```

---

## 📊 Estadísticas Actuales

Ejecuta esto para ver cuántos planes hay:

```sql
SELECT 
    COUNT(*) as total_causas_con_plan,
    COUNT(CASE WHEN cr."tipoGestion" = 'PLAN' THEN 1 END) as solo_plan,
    COUNT(CASE WHEN cr."tipoGestion" = 'AMBOS' THEN 1 END) as plan_y_control,
    COUNT(DISTINCT cr."riesgoId") as riesgos_con_plan
FROM "CausaRiesgo" cr
WHERE cr."tipoGestion" IN ('PLAN', 'AMBOS')
   OR cr.gestion->>'planDescripcion' IS NOT NULL;
```

---

## ✅ Checklist de Decisión

- [ ] ¿Quieres aplicar solo el schema ahora? (Opción A - Recomendado)
- [ ] ¿O prefieres migrar también los datos? (Opción B - Más completo)
- [ ] ¿Cuántos planes hay actualmente en producción?
- [ ] ¿Los usuarios están creando planes nuevos frecuentemente?
- [ ] ¿Tienes tiempo para probar la migración de datos?

**Dime qué opción prefieres y procedemos.**
