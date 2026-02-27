# ✅ FIX: Soporte para modo "ambos"

## 🎯 Problema

El frontend enviaba `modo: "ambos"` cuando un usuario era tanto director como dueño de proceso, pero el backend lo rechazaba con error 400:

```
[BACKEND] Modo inválido: ambos
PUT /api/procesos/12/responsables 400
Error: Cada responsable debe tener modo "director" o "proceso"
```

## 📊 Ejemplo del Error

**Request del frontend:**
```json
{
  "responsables": [
    {
      "usuarioId": 122,
      "modo": "ambos"  // ❌ Backend rechazaba esto
    },
    {
      "usuarioId": 127,
      "modo": "director"
    }
  ]
}
```

**Respuesta del backend:**
```json
{
  "error": "Cada responsable debe tener modo 'director' o 'proceso'",
  "responsableInvalido": {
    "usuarioId": 122,
    "modo": "ambos"
  }
}
```

## ✅ Solución Implementada

El backend ahora acepta `modo: "ambos"` y lo expande automáticamente a DOS registros:

### Código Actualizado

**Antes:**
```typescript
// Validar que todos los modos sean válidos
for (const responsableData of responsablesData) {
    if (!responsableData.modo || !['director', 'proceso'].includes(responsableData.modo)) {
        return res.status(400).json({ 
            error: 'Cada responsable debe tener modo "director" o "proceso"'
        });
    }
}
```

**Después:**
```typescript
// Expandir "ambos" a dos registros separados
const responsablesExpandidos: Array<{ usuarioId: number; modo: string }> = [];
for (const responsableData of responsablesData) {
    if (responsableData.modo === 'ambos') {
        // Crear dos registros: uno como director y otro como proceso
        responsablesExpandidos.push({
            usuarioId: responsableData.usuarioId,
            modo: 'director'
        });
        responsablesExpandidos.push({
            usuarioId: responsableData.usuarioId,
            modo: 'proceso'
        });
    } else if (['director', 'proceso'].includes(responsableData.modo)) {
        responsablesExpandidos.push(responsableData);
    } else {
        return res.status(400).json({ 
            error: 'Cada responsable debe tener modo "director", "proceso" o "ambos"'
        });
    }
}

// Usar los responsables expandidos
responsablesData = responsablesExpandidos;
```

## 📊 Cómo Funciona Ahora

### Ejemplo 1: Usuario con modo "ambos"

**Request:**
```json
{
  "responsables": [
    {
      "usuarioId": 122,
      "modo": "ambos"
    }
  ]
}
```

**Se expande a:**
```json
[
  {
    "usuarioId": 122,
    "modo": "director"
  },
  {
    "usuarioId": 122,
    "modo": "proceso"
  }
}
```

**Resultado en BD:**
```sql
-- Se crean DOS registros en ProcesoResponsable
INSERT INTO "ProcesoResponsable" (procesoId, usuarioId, modo) VALUES
  (11, 122, 'director'),
  (11, 122, 'proceso');
```

### Ejemplo 2: Múltiples usuarios con diferentes modos

**Request:**
```json
{
  "responsables": [
    {
      "usuarioId": 122,
      "modo": "ambos"
    },
    {
      "usuarioId": 127,
      "modo": "director"
    }
  ]
}
```

**Se expande a:**
```json
[
  {
    "usuarioId": 122,
    "modo": "director"
  },
  {
    "usuarioId": 122,
    "modo": "proceso"
  },
  {
    "usuarioId": 127,
    "modo": "director"
  }
]
```

**Resultado en BD:**
```sql
-- Se crean TRES registros
INSERT INTO "ProcesoResponsable" (procesoId, usuarioId, modo) VALUES
  (11, 122, 'director'),
  (11, 122, 'proceso'),
  (11, 127, 'director');
```

## 🎯 Modos Soportados

| Modo | Descripción | Registros Creados |
|------|-------------|-------------------|
| `"director"` | Solo director de área | 1 registro con modo="director" |
| `"proceso"` | Solo dueño de proceso | 1 registro con modo="proceso" |
| `"ambos"` | Director Y dueño de proceso | 2 registros (director + proceso) |

## ✅ Beneficios

1. ✅ **Compatibilidad con frontend:** Acepta el formato que envía el frontend
2. ✅ **Flexibilidad:** Un usuario puede tener ambos roles
3. ✅ **Transparente:** El frontend no necesita cambios
4. ✅ **Consistente:** La BD siempre tiene registros con modo="director" o modo="proceso"

## 🔍 Validación

### Modos válidos:
- ✅ `"director"`
- ✅ `"proceso"`
- ✅ `"ambos"`

### Modos inválidos:
- ❌ `"gerente"`
- ❌ `"admin"`
- ❌ `null`
- ❌ `undefined`
- ❌ `""`

## 🚀 Testing

### Test 1: Usuario con modo "ambos"
```bash
curl -X PUT http://localhost:8080/api/procesos/11/responsables \
  -H "Content-Type: application/json" \
  -d '{
    "responsables": [
      {"usuarioId": 122, "modo": "ambos"}
    ]
  }'
```

**Resultado esperado:**
```json
[
  {
    "id": 1,
    "procesoId": 11,
    "usuario": {...},
    "modo": "director",
    "createdAt": "..."
  },
  {
    "id": 2,
    "procesoId": 11,
    "usuario": {...},
    "modo": "proceso",
    "createdAt": "..."
  }
]
```

### Test 2: Múltiples usuarios
```bash
curl -X PUT http://localhost:8080/api/procesos/11/responsables \
  -H "Content-Type: application/json" \
  -d '{
    "responsables": [
      {"usuarioId": 122, "modo": "ambos"},
      {"usuarioId": 127, "modo": "director"}
    ]
  }'
```

**Resultado esperado:** 3 registros (122 con director+proceso, 127 con director)

## 📝 Notas Importantes

1. **Expansión automática:** El modo "ambos" se expande ANTES de guardar en la BD
2. **Sin duplicados:** El constraint `@@unique([procesoId, usuarioId, modo])` previene duplicados
3. **Eliminación limpia:** Al actualizar, se eliminan TODOS los registros anteriores y se crean los nuevos
4. **Logs claros:** Los logs muestran cuando se expande "ambos"

## 🔄 Migración

No se requiere migración de datos. Este cambio solo afecta cómo se procesan los requests nuevos.

---

**Fecha:** 27/02/2026  
**Archivo modificado:** `src/controllers/proceso-responsables.controller.ts`  
**Función:** `updateResponsablesProceso`
