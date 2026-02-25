# Implementación Completa: Sistema de Gestión AMBOS con Estado

## Resumen
Sistema completo para manejar causas con tipo de gestión AMBOS, permitiendo eliminar y re-agregar controles y planes de acción de forma independiente, manteniendo trazabilidad.

## Características Implementadas

### 1. Eliminación Parcial de AMBOS
- **Eliminar solo Control**: La causa mantiene `tipoGestion = 'AMBOS'` con `estadoAmbos.controlActivo = false`
- **Eliminar solo Plan**: La causa mantiene `tipoGestion = 'AMBOS'` con `estadoAmbos.planActivo = false`
- **Eliminar Ambos**: La causa vuelve a `tipoGestion = null` (sin clasificar)

### 2. Re-clasificación Inteligente
Cuando una causa AMBOS tiene partes eliminadas, vuelve a aparecer en CLASIFICACIÓN con opciones contextuales:

#### Caso 1: Solo falta Control
```
✓ Control (Re-agregar)
✗ Plan de Acción (Ya aplicado) - disabled
```

#### Caso 2: Solo falta Plan
```
✗ Control (Ya aplicado) - disabled
✓ Plan de Acción (Re-agregar)
```

#### Caso 3: Faltan Ambos (pero aún es AMBOS)
```
✓ Control (Re-agregar)
✓ Plan de Acción (Re-agregar)
✓ Ambos (Re-agregar)
```

#### Caso 4: Ambos eliminados (vuelve a sin clasificar)
```
✓ Control
✓ Plan de Acción
✓ Ambos
```
(Opciones normales, sin "Re-agregar")

### 3. Preservación de Datos
- Al eliminar Control: Los datos del Plan se preservan en `gestion`
- Al eliminar Plan: Los datos del Control se preservan en `gestion`
- Al eliminar Ambos: Se guarda historial en `gestion.historial` para trazabilidad

### 4. Badges Visuales
Las causas AMBOS incompletas muestran badges rojos con icono de advertencia:
- "AMBOS - Falta Control"
- "AMBOS - Falta Plan"
- "AMBOS - Incompleto" (cuando faltan ambos)

### 5. Filtros Inteligentes
- **CLASIFICACIÓN**: Muestra causas sin clasificar + AMBOS incompletos
- **CONTROLES**: Solo muestra causas con `controlActivo = true`
- **PLANES**: Solo muestra causas con `planActivo = true`

## Flujos de Usuario

### Flujo 1: Crear AMBOS → Eliminar Control → Re-agregar Control
1. Usuario crea causa con tipo AMBOS (control + plan)
2. Usuario elimina control desde pestaña CONTROLES
3. Causa aparece en CLASIFICACIÓN con opción "Control (Re-agregar)"
4. Usuario re-agrega control
5. Causa vuelve a CONTROLES y PLANES con ambos activos

### Flujo 2: Crear AMBOS → Eliminar Ambos → Volver a clasificar
1. Usuario crea causa con tipo AMBOS (control + plan)
2. Usuario elimina control desde CONTROLES
3. Usuario elimina plan desde PLANES
4. Causa vuelve a CLASIFICACIÓN como "sin clasificar"
5. Usuario puede elegir cualquier tipo de gestión (Control, Plan, Ambos)

### Flujo 3: Crear AMBOS → Eliminar Control → Eliminar Plan → Re-agregar Ambos
1. Usuario crea causa con tipo AMBOS
2. Usuario elimina control
3. Usuario elimina plan
4. Causa aparece en CLASIFICACIÓN con opciones normales
5. Usuario selecciona "Ambos" y completa ambos formularios
6. Causa vuelve a CONTROLES y PLANES

## Estructura de Datos

### Campo `gestion` (JSON)
```typescript
{
  estadoAmbos: {
    controlActivo: boolean,  // true si control está activo
    planActivo: boolean      // true si plan está activo
  },
  
  // Datos del plan
  planDescripcion: string,
  planDetalle: string,
  planResponsable: string,
  planDecision: string,
  planFechaEstimada: string,
  planEstado: string,
  
  // Datos del control
  aplicabilidad: string,
  puntajeAplicabilidad: number,
  cobertura: string,
  puntajeCobertura: number,
  // ... más campos del control
  
  // Historial (cuando se eliminan ambos)
  historial?: {
    fechaEliminacion: string,
    tipoGestionAnterior: string,
    datosAnteriores: object
  }
}
```

### Estados Posibles de una Causa

| tipoGestion | estadoAmbos | Significado | Aparece en |
|-------------|-------------|-------------|------------|
| `null` | - | Sin clasificar | CLASIFICACIÓN |
| `'CONTROL'` | - | Solo control | CONTROLES |
| `'PLAN'` | - | Solo plan | PLANES |
| `'AMBOS'` | `{true, true}` | Ambos activos | CONTROLES + PLANES |
| `'AMBOS'` | `{false, true}` | Solo plan activo | CLASIFICACIÓN + PLANES |
| `'AMBOS'` | `{true, false}` | Solo control activo | CLASIFICACIÓN + CONTROLES |
| `'AMBOS'` | `{false, false}` | ❌ No existe - se convierte a `null` | - |

## Archivos Modificados

### Frontend
- `gestion-riesgos-app/src/pages/controles/ControlesYPlanesAccionPage.tsx`
  - Función `handleEliminarClasificacion`: Detecta cuando ambos están inactivos y vuelve a `null`
  - Función `handleGuardarEvaluacion`: Maneja re-agregado de AMBOS completo
  - Filtros `riesgosPendientes`, `riesgosConControles`, `riesgosConPlanes`: Usan `estadoAmbos`
  - Selector de tipo de gestión: Muestra opciones contextuales según estado
  - Badges: Muestran estado de AMBOS incompleto

### Backend
- `gestion_riesgos_backend/src/controllers/riesgos.controller.ts`
  - Función `updateCausa`: Acepta `tipoGestion` y `gestion` (sin cambios necesarios)

## Ventajas de esta Implementación

1. **Intuitivo**: Si eliminas ambos, vuelves al inicio
2. **Flexible**: Puedes re-agregar solo uno o ambos
3. **Trazable**: El historial se guarda en `gestion.historial`
4. **Consistente**: Una causa sin clasificar siempre tiene `tipoGestion = null`
5. **Limpio**: No hay estados ambiguos o confusos

## Casos Edge Manejados

✅ Eliminar control de AMBOS → Mantiene plan  
✅ Eliminar plan de AMBOS → Mantiene control  
✅ Eliminar ambos de AMBOS → Vuelve a sin clasificar  
✅ Re-agregar control a AMBOS incompleto → Reactiva control  
✅ Re-agregar plan a AMBOS incompleto → Reactiva plan  
✅ Re-agregar ambos cuando ambos están eliminados → Crea nuevo AMBOS  
✅ Backward compatibility → Si no existe `estadoAmbos`, asume ambos activos  

## Testing Recomendado

1. Crear causa AMBOS → Eliminar control → Verificar que plan se mantiene
2. Crear causa AMBOS → Eliminar plan → Verificar que control se mantiene
3. Crear causa AMBOS → Eliminar control → Eliminar plan → Verificar que vuelve a sin clasificar
4. Crear causa AMBOS → Eliminar ambos → Re-agregar AMBOS → Verificar que funciona
5. Crear causa AMBOS → Eliminar control → Re-agregar control → Verificar que datos del plan se mantienen

## Fecha de Implementación
2026-02-25
