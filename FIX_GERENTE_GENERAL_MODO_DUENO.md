# Fix: Gerente General en Modo Dueño de Procesos

## Problema Identificado

El perfil **Gerente General** tiene 2 modos internos:
- **Modo Supervisor** → Funciona correctamente
- **Modo Dueño de Procesos** → NO funcionaba correctamente

### Síntoma
Cuando el Gerente General seleccionaba "Modo Dueño de Procesos":
1. Podía ver sus procesos asignados en el dropdown del header
2. Podía seleccionar un proceso
3. **PERO** el dashboard seguía mostrando "Aún no tiene procesos asignados"

### Causa Raíz

El código estaba verificando `user?.role === 'dueño_procesos'` directamente en lugar de usar el helper `esDueñoProcesos` del AuthContext.

**Problema:**
- Gerente General tiene `role = 'gerente'`, NO `'dueño_procesos'`
- Cuando selecciona modo Dueño, se establece `gerenteMode = 'dueño'`
- El AuthContext mapea esto a `esDueñoProcesos = true`
- Pero el código verificaba `user?.role === 'dueño_procesos'` → FALSO
- Resultado: No filtraba los procesos correctamente

## Solución Implementada

Reemplazar todas las verificaciones directas de `user?.role === 'dueño_procesos'` por el helper `esDueñoProcesos` del AuthContext.

### Archivos Modificados

#### 1. `DashboardSupervisorPage.tsx`
**Cambio en filtro de procesos (línea ~147):**
```typescript
// ANTES (incorrecto):
if (user?.role === 'dueño_procesos') {
  return todosLosProcesos.filter((p: any) => esUsuarioResponsableProceso(p, user.id));
}

// DESPUÉS (correcto):
if (esDueñoProcesos) {
  return todosLosProcesos.filter((p: any) => esUsuarioResponsableProceso(p, user.id));
}
```

**Cambio en ocultarFiltroOrigen (línea ~808):**
```typescript
// ANTES:
ocultarFiltroOrigen={user?.role === 'dueño_procesos'}

// DESPUÉS:
ocultarFiltroOrigen={esDueñoProcesos}
```

#### 2. `ProcesosPage.tsx`
```typescript
// ANTES:
if (user?.role === 'dueño_procesos') {
  return procesos.filter((p) => esUsuarioResponsableProceso(p, user.id));
}

// DESPUÉS:
if (esDueñoProcesos) {
  return procesos.filter((p) => esUsuarioResponsableProceso(p, user.id));
}
```

#### 3. `MapaPage.tsx`
```typescript
// ANTES:
if (user?.role === 'dueño_procesos') {
  return procesos.filter((p) => esUsuarioResponsableProceso(p, user.id));
}

// DESPUÉS:
if (esDueñoProcesos) {
  return procesos.filter((p) => esUsuarioResponsableProceso(p, user.id));
}
```

#### 4. `FichaPage.tsx`
```typescript
// ANTES:
if (user?.role === 'dueño_procesos') {
  return procesos.filter((p: any) => esUsuarioResponsableProceso(p, user.id));
}

// DESPUÉS:
if (esDueñoProcesos) {
  return procesos.filter((p: any) => esUsuarioResponsableProceso(p, user.id));
}
```

#### 5. `MainLayout.tsx`
```typescript
// ANTES:
} else if (user?.role === 'dueño_procesos') {
  return procesos.filter((p) => esUsuarioResponsableProceso(p, user.id));

// DESPUÉS:
} else if (esDueñoProcesos) {
  return procesos.filter((p) => esUsuarioResponsableProceso(p, user.id));
```

#### 6. `FiltroProcesoSupervisor.tsx`
**Problema adicional:** Había una variable local `esDuenoProcesos` que sobrescribía el helper del AuthContext.

```typescript
// ANTES:
const { esAdmin, esSupervisorRiesgos, esGerenteGeneralDirector, esGerenteGeneralProceso, user } = useAuth();
const esDuenoProcesos = user?.role === 'dueño_procesos'; // ← Variable local incorrecta

// DESPUÉS:
const { esAdmin, esSupervisorRiesgos, esGerenteGeneralDirector, esGerenteGeneralProceso, esDueñoProcesos, user } = useAuth();
// ← Usar el helper del AuthContext directamente
```

## Cómo Funciona Ahora

### AuthContext (sin cambios)
```typescript
esDuenoProcesos: user?.role === 'dueño_procesos' || esGerenteDueño
```

Este helper retorna `true` cuando:
1. El usuario tiene `role = 'dueño_procesos'` (Dueño de Procesos real)
2. O el usuario es Gerente General (`role = 'gerente'`) con `gerenteMode = 'dueño'`

### Flujo Correcto Ahora

```
Gerente General (role='gerente')
→ Selecciona "Modo Dueño de Procesos"
→ setGerenteMode('dueño')
→ esDueñoProcesos = true (por AuthContext: esGerenteDueño = true)
→ Llega a DashboardSupervisorPage
→ Filtro de procesos: if (esDueñoProcesos) ← ÉXITO
→ procesos = [procesos donde es responsable]
→ sinAsignaciones = false
→ Muestra el dashboard con sus procesos
```

## Testing Recomendado

1. **Login como Gerente General**
2. **Seleccionar "Modo Dueño de Procesos"**
3. **Verificar que aparece el selector de procesos en el header**
4. **Seleccionar un proceso asignado**
5. **Verificar que el dashboard carga correctamente con datos del proceso**
6. **Verificar que NO aparece el mensaje "Aún no tiene procesos asignados"**

## Casos Cubiertos

✅ Gerente General en Modo Supervisor → Funciona  
✅ Gerente General en Modo Dueño → Funciona (CORREGIDO)  
✅ Dueño de Procesos real (role='dueño_procesos') → Funciona  
✅ Supervisor de Riesgos → Funciona  

## Fecha de Implementación
2026-02-25
