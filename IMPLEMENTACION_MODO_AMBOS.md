# IMPLEMENTACIÓN: Modo "Ambos" para Gerentes

## FECHA: 2026-02-25

## REQUERIMIENTO
- Cuando un gerente es asignado a un proceso, debe aparecer en **ambas pestañas** (Modo Director y Modo Proceso)
- Las selecciones deben estar **sincronizadas** entre ambas pestañas
- No se puede elegir solo un modo, siempre son ambos
- **NO modificar la base de datos directamente** (está en Render)

## SOLUCIÓN IMPLEMENTADA

### Concepto: Modo "ambos"
En lugar de guardar dos registros separados (que violaría la restricción única), guardamos **un solo registro** con `modo: "ambos"` para gerentes.

### Ventajas
- ✅ No requiere cambios en la estructura de la base de datos
- ✅ No viola la restricción única `@@unique([procesoId, usuarioId])`
- ✅ Sincronización automática entre pestañas
- ✅ Código más simple y mantenible

---

## CAMBIOS REALIZADOS

### 1. FRONTEND: `AreasPage.tsx`

#### A. Función `handleProcessToggle()` (Línea ~368)
**ANTES:**
```typescript
const modoAutomatico: 'dueño' | 'supervisor' | null = esGerente 
    ? (assignmentSubTab === 0 ? 'supervisor' : 'dueño')
    : null;
```

**DESPUÉS:**
```typescript
const modoAsignado: 'ambos' | null = esGerente ? 'ambos' : null;
```

**CAMBIO:** Gerentes siempre se asignan con modo "ambos", independiente de la pestaña activa.

---

#### B. Función `handleAreaToggle()` (Línea ~402)
**ANTES:**
```typescript
const modoAutomatico: 'dueño' | 'supervisor' | null = esGerente 
    ? (assignmentSubTab === 0 ? 'supervisor' : 'dueño')
    : null;
```

**DESPUÉS:**
```typescript
const modoAsignado: 'ambos' | null = esGerente ? 'ambos' : null;
```

**CAMBIO:** Igual que `handleProcessToggle`, usa modo "ambos" para gerentes.

---

#### C. Función `isProcesoResponsable()` (Línea ~540)
**ANTES:**
```typescript
const isProcesoResponsable = (procesoId, usuarioId, modoEsperado?) => {
    // Verificaba modo específico
    if (modoEsperado !== undefined) {
        return responsables.some(r => 
            r.usuarioId === usuarioId && r.modo === modoEsperado
        );
    }
    return responsables.some(r => r.usuarioId === usuarioId);
};
```

**DESPUÉS:**
```typescript
const isProcesoResponsable = (procesoId, usuarioId) => {
    // Simplificado: solo verifica si el usuario está en la lista
    // Si tiene modo "ambos", aparece en ambas pestañas
    return responsables.some(r => r.usuarioId === usuarioId);
};
```

**CAMBIO:** Eliminado parámetro `modoEsperado`. Ahora solo verifica si el usuario está asignado.

---

#### D. Función `getAreaState()` (Línea ~555)
**ANTES:**
```typescript
const modoEsperado: 'dueño' | 'supervisor' | null = esGerente 
    ? (assignmentSubTab === 0 ? 'supervisor' : 'dueño')
    : null;

const allOwned = areaProcesos.every(p => 
    isProcesoResponsable(p.id, usuarioId, modoEsperado)
);
```

**DESPUÉS:**
```typescript
const allOwned = areaProcesos.every(p => 
    isProcesoResponsable(p.id, usuarioId)
);
```

**CAMBIO:** Ya no pasa `modoEsperado` porque no es necesario.

---

#### E. Renderizado de Chips (Línea ~700)
**ANTES:**
```typescript
{esGerente && isOwned && (
    <Chip 
        label={modoEsperado === 'supervisor' ? 'Supervisor' : 'Dueño'} 
        size="small" 
        color={modoEsperado === 'supervisor' ? 'warning' : 'primary'}
    />
)}
```

**DESPUÉS:**
```typescript
{esGerente && isOwned && (
    <Chip 
        label="Ambos Modos" 
        size="small" 
        color="success"
        variant="outlined"
    />
)}
```

**CAMBIO:** Muestra "Ambos Modos" en verde para gerentes asignados.

---

#### F. Lista de Responsables (Línea ~715)
**ANTES:**
```typescript
const modoLabel = esGerenteResp && resp.modo 
    ? ` (${resp.modo === 'dueño' ? 'Dueño' : 'Supervisor'})` 
    : '';
```

**DESPUÉS:**
```typescript
const modoLabel = esGerenteResp && resp.modo === 'ambos' 
    ? ' (Ambos Modos)' 
    : '';
```

**CAMBIO:** Muestra "(Ambos Modos)" para gerentes con modo "ambos".

---

#### G. Alertas de Pestañas (Línea ~631)
**ANTES:**
```typescript
<Alert severity="warning">
    <strong>Modo Director (Supervisor):</strong> Los procesos seleccionados 
    se asignarán automáticamente como <strong>Supervisor</strong>.
</Alert>
```

**DESPUÉS:**
```typescript
<Alert severity="info">
    <strong>Modo Director (Supervisor):</strong> Los procesos seleccionados 
    se asignarán automáticamente en <strong>ambos modos</strong> 
    (Supervisor y Dueño de Proceso). Las selecciones se sincronizan 
    entre ambas pestañas.
</Alert>
```

**CAMBIO:** Informa al usuario que las selecciones se sincronizan.

---

#### H. Función `saveAssignments()` (Línea ~442)
**ANTES:**
```typescript
const responsablesConModo = responsables.map(r => {
    const usuario = usuarios.find(u => u.id === r.usuarioId);
    const esGerente = usuario?.role === 'gerente';
    const modoFinal = esGerente && !r.modo ? 'dueño' : (r.modo || null);
    return { usuarioId: r.usuarioId, modo: modoFinal };
});
```

**DESPUÉS:**
```typescript
const responsablesConModo = responsables.map(r => ({
    usuarioId: r.usuarioId,
    modo: r.modo || null
}));
```

**CAMBIO:** Simplificado. Envía el modo tal como está (incluyendo "ambos").

---

### 2. BACKEND: `proceso-responsables.controller.ts`

#### A. Validación de Modo (Línea ~54)
**ANTES:**
```typescript
if (modo && !['dueño', 'supervisor'].includes(modo)) {
    return res.status(400).json({ 
        error: 'modo debe ser "dueño" o "supervisor"' 
    });
}
```

**DESPUÉS:**
```typescript
if (modo && !['dueño', 'supervisor', 'ambos'].includes(modo)) {
    return res.status(400).json({ 
        error: 'modo debe ser "dueño", "supervisor" o "ambos"' 
    });
}
```

**CAMBIO:** Acepta "ambos" como modo válido.

---

#### B. Normalización de Modos (Línea ~220)
**ANTES:**
```typescript
if (esGerente) {
    if (!responsableData.modo || !['dueño', 'supervisor'].includes(responsableData.modo)) {
        responsableData.modo = 'dueño'; // Por defecto
    }
}
```

**DESPUÉS:**
```typescript
if (esGerente) {
    if (!responsableData.modo || !['dueño', 'supervisor', 'ambos'].includes(responsableData.modo)) {
        responsableData.modo = 'ambos'; // Por defecto
    }
}
```

**CAMBIO:** Acepta "ambos" y lo usa como valor por defecto para gerentes.

---

### 3. FRONTEND: `useAsignaciones.ts`

#### A. Filtro para Gerente en Modo Director (Línea ~60)
**ANTES:**
```typescript
if (esGerenteGeneralDirector) {
    procesosAsignados = procesos.filter((p: any) =>
        (p.responsablesList || []).some(
            (r: any) =>
                Number(r.id) === userIdNum &&
                r.role === 'gerente' &&
                r.modo === 'supervisor'
        )
    );
}
```

**DESPUÉS:**
```typescript
if (esGerenteGeneralDirector) {
    procesosAsignados = procesos.filter((p: any) =>
        (p.responsablesList || []).some(
            (r: any) =>
                Number(r.id) === userIdNum &&
                r.role === 'gerente' &&
                (r.modo === 'supervisor' || r.modo === 'ambos')
        )
    );
}
```

**CAMBIO:** Incluye procesos con modo "ambos" en la vista de Director.

---

#### B. Filtro para Gerente en Modo Dueño (Línea ~72)
**ANTES:**
```typescript
else if (esGerenteDueño) {
    procesosAsignados = procesos.filter((p: any) =>
        (p.responsablesList || []).some(
            (r: any) =>
                Number(r.id) === userIdNum &&
                r.role === 'gerente' &&
                r.modo === 'dueño'
        )
    );
}
```

**DESPUÉS:**
```typescript
else if (esGerenteDueño) {
    procesosAsignados = procesos.filter((p: any) =>
        (p.responsablesList || []).some(
            (r: any) =>
                Number(r.id) === userIdNum &&
                r.role === 'gerente' &&
                (r.modo === 'dueño' || r.modo === 'ambos')
        )
    );
}
```

**CAMBIO:** Incluye procesos con modo "ambos" en la vista de Dueño de Proceso.

---

## COMPORTAMIENTO RESULTANTE

### Asignación de Gerentes
1. Usuario selecciona un gerente (ej: Alicia Robayo)
2. Marca procesos en **cualquier pestaña** (Modo Director o Modo Proceso)
3. Los procesos marcados aparecen **automáticamente en ambas pestañas**
4. Al guardar, se crea **un solo registro** con `modo: "ambos"`
5. El gerente puede acceder al proceso desde ambas vistas

### Visualización
- **Pestaña Modo Director:** Muestra procesos con `modo === 'supervisor'` o `modo === 'ambos'`
- **Pestaña Modo Proceso:** Muestra procesos con `modo === 'dueño'` o `modo === 'ambos'`
- **Badge:** Muestra "Ambos Modos" en verde para gerentes

### Base de Datos
```
ProcesoResponsable
| id | procesoId | usuarioId | modo   |
|----|-----------|-----------|--------|
| 1  | 5         | 123       | ambos  |  ← Un solo registro
```

---

## COMPATIBILIDAD

### Datos Existentes
- ✅ Registros con `modo: 'dueño'` siguen funcionando
- ✅ Registros con `modo: 'supervisor'` siguen funcionando
- ✅ Registros con `modo: null` siguen funcionando
- ✅ Nuevos registros con `modo: 'ambos'` funcionan correctamente

### Restricción Única
- ✅ No se viola `@@unique([procesoId, usuarioId])`
- ✅ Un usuario solo puede tener un registro por proceso
- ✅ El campo `modo` diferencia el tipo de asignación

---

## PRUEBAS RECOMENDADAS

1. ✅ Asignar Alicia Robayo en Modo Director → Verificar que aparece en ambas pestañas
2. ✅ Asignar Alicia Robayo en Modo Proceso → Verificar que aparece en ambas pestañas
3. ✅ Guardar asignaciones → Verificar que no hay error de duplicados
4. ✅ Verificar badge "Ambos Modos" en verde
5. ✅ Verificar que Juan Jose Maldonado sigue funcionando
6. ✅ Verificar que usuarios no gerentes siguen funcionando con `modo: null`

---

## CONCLUSIÓN

✅ **Implementación completada sin modificar la base de datos**
✅ **Sincronización automática entre pestañas**
✅ **Compatible con datos existentes**
✅ **Código más simple y mantenible**

El sistema ahora usa `modo: "ambos"` para gerentes, lo que permite que aparezcan en ambas pestañas sin violar la restricción única de la base de datos.
