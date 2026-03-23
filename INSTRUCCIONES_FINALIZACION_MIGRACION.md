# Instrucciones para Finalizar la Migración de Normalización

## ✅ Lo que YA está hecho

1. **Schema de Prisma completamente actualizado** (`prisma/schema.prisma`)
2. **Controlador de riesgos actualizado** para tipologías y causas
3. **Referencias menores corregidas** (Usuario.roleRelacion)
4. **Script SQL de migración creado** (`migrations/normalizacion_completa.sql`)

## 🔧 Lo que FALTA hacer

### PASO 1: Generar Migración de Prisma

```bash
cd gestion_riesgos_backend
npx prisma migrate dev --name normalizacion_completa
```

Esto generará la migración basada en los cambios del schema.

### PASO 2: Refactorizar Servicios Críticos

Los siguientes 3 archivos necesitan refactorización completa porque usan intensivamente el campo `gestion` (JSONB) que ya no existe:

#### A. `src/services/recalculoResidual.service.ts`

**Problema**: Lee y escribe en `CausaRiesgo.gestion` (JSONB eliminado)

**Cambios necesarios**:

1. Reemplazar todas las queries que filtran por `tipoGestion`:
```typescript
// ANTES
const causas = await prisma.causaRiesgo.findMany({
  where: {
    tipoGestion: { in: ['CONTROL', 'AMBOS'] },
    gestion: { not: null }
  }
});

// DESPUÉS
const causas = await prisma.causaRiesgo.findMany({
  where: {
    controles: { some: {} } // Solo causas que tienen controles
  },
  include: {
    controles: true,
    riesgo: { include: { evaluacion: true } }
  }
});
```

2. Reemplazar lecturas de `gestion.*` por campos de `ControlRiesgo`:
```typescript
// ANTES
const gestion = causa.gestion || {};
const puntajes = {
  aplicabilidad: gestion.puntajeAplicabilidad || 0,
  cobertura: gestion.puntajeCobertura || 0,
  // ...
};

// DESPUÉS
const control = causa.controles[0]; // O iterar si hay múltiples
const puntajes = {
  aplicabilidad: control?.aplicabilidad || 0,
  cobertura: control?.cobertura || 0,
  // ...
};
```

3. Actualizar `ControlRiesgo` directamente:
```typescript
// ANTES
await prisma.causaRiesgo.update({
  where: { id: causaId },
  data: { gestion: gestionActualizada }
});

// DESPUÉS
await prisma.controlRiesgo.updateMany({
  where: { causaRiesgoId: causaId },
  data: {
    evaluacionPreliminar,
    evaluacionDefinitiva,
    tipoMitigacion,
    recalculadoEn: new Date()
  }
});
```

#### B. `src/services/alertas-vencimiento.service.ts`

**Problema**: Lee planes desde `CausaRiesgo.gestion`

**Cambios necesarios**:

1. Reemplazar query de causas con planes:
```typescript
// ANTES
const causasConPlanes = await prisma.causaRiesgo.findMany({
  where: {
    tipoGestion: { in: ['PLAN', 'AMBOS'] },
    gestion: { not: null }
  }
});

// DESPUÉS
const planesActivos = await prisma.planAccion.findMany({
  where: {
    causaRiesgoId: { not: null },
    estado: { not: 'COMPLETADO' }
  },
  include: {
    causaRiesgo: {
      include: {
        riesgo: {
          include: { proceso: true }
        }
      }
    }
  }
});
```

2. Reemplazar acceso a campos del plan:
```typescript
// ANTES
const gestion = causa.gestion as any;
const fechaEstimada = gestion.planFechaEstimada;
const responsable = gestion.planResponsable;

// DESPUÉS
const fechaEstimada = plan.fechaFin;
const responsable = plan.responsable;
```

#### C. `src/controllers/plan-trazabilidad.controller.ts`

**Problema**: Gestiona planes y estados en `CausaRiesgo.gestion`

**Cambios necesarios**:

1. Actualizar `actualizarEstadoPlan`:
```typescript
// ANTES
const gestion = (causa.gestion as any) || {};
const gestionActualizada = {
  ...gestion,
  planEstado: estado,
  historialEstados: [...]
};
await prisma.causaRiesgo.update({
  where: { id: causaId },
  data: { gestion: gestionActualizada }
});

// DESPUÉS
// Actualizar plan
await prisma.planAccion.updateMany({
  where: { causaRiesgoId: causaId },
  data: { estado }
});

// Crear entrada en historial
await prisma.historialEstadoPlan.create({
  data: {
    causaRiesgoId: causaId,
    estado,
    responsable,
    detalle,
    decision,
    porcentajeAvance,
    fechaEstado: new Date()
  }
});
```

2. Actualizar `obtenerPlanesAccion`:
```typescript
// ANTES
const causas = await prisma.causaRiesgo.findMany({
  where: { tipoGestion: { in: ['PLAN', 'AMBOS'] } }
});
const planes = causas.map(causa => {
  const gestion = (causa.gestion as any) || {};
  return {
    descripcion: gestion.planDescripcion,
    estado: gestion.planEstado,
    // ...
  };
});

// DESPUÉS
const planes = await prisma.planAccion.findMany({
  where: { causaRiesgoId: { not: null } },
  include: {
    causaRiesgo: {
      include: {
        riesgo: {
          include: { proceso: true }
        }
      }
    }
  }
});
```

### PASO 3: Crear Endpoints para Tipologías Extendidas

Crear nuevo archivo `src/controllers/tipologias-extendidas.controller.ts`:

```typescript
import { Request, Response } from 'express';
import prisma from '../prisma';

// GET /api/catalogos/tipologias-extendidas
export const obtenerTipologiasExtendidas = async (req: Request, res: Response) => {
  try {
    const { nivel } = req.query;
    const where: any = { activo: true };
    if (nivel) where.nivel = Number(nivel);

    const tipologias = await prisma.tipologiaRiesgoExtendida.findMany({
      where,
      include: { subtipo: true },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }]
    });

    res.json(tipologias);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipologías extendidas' });
  }
};

// POST /api/catalogos/tipologias-extendidas
export const crearTipologiaExtendida = async (req: Request, res: Response) => {
  try {
    const { subtipoId, nivel, nombre, descripcion } = req.body;

    if (!nivel || ![3, 4].includes(Number(nivel))) {
      return res.status(400).json({ error: 'El nivel debe ser 3 o 4' });
    }

    const tipologia = await prisma.tipologiaRiesgoExtendida.create({
      data: {
        subtipoId: subtipoId ? Number(subtipoId) : null,
        nivel: Number(nivel),
        nombre,
        descripcion
      }
    });

    res.status(201).json(tipologia);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una tipología con ese nombre y nivel' });
    }
    res.status(500).json({ error: 'Error al crear tipología extendida' });
  }
};

// PUT /api/catalogos/tipologias-extendidas/:id
export const actualizarTipologiaExtendida = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const tipologia = await prisma.tipologiaRiesgoExtendida.update({
      where: { id: Number(id) },
      data: { nombre, descripcion, activo }
    });

    res.json(tipologia);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar tipología extendida' });
  }
};

// DELETE /api/catalogos/tipologias-extendidas/:id
export const eliminarTipologiaExtendida = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar si está en uso
    const enUso = await prisma.riesgo.count({
      where: {
        OR: [
          { tipologiaTipo3Id: Number(id) },
          { tipologiaTipo4Id: Number(id) }
        ]
      }
    });

    if (enUso > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar porque está en uso por riesgos' 
      });
    }

    await prisma.tipologiaRiesgoExtendida.delete({
      where: { id: Number(id) }
    });

    res.json({ message: 'Tipología eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tipología extendida' });
  }
};
```

Agregar rutas en `src/routes/catalogos.routes.ts`:

```typescript
import { 
  obtenerTipologiasExtendidas,
  crearTipologiaExtendida,
  actualizarTipologiaExtendida,
  eliminarTipologiaExtendida
} from '../controllers/tipologias-extendidas.controller';

router.get('/tipologias-extendidas', obtenerTipologiasExtendidas);
router.post('/tipologias-extendidas', crearTipologiaExtendida);
router.put('/tipologias-extendidas/:id', actualizarTipologiaExtendida);
router.delete('/tipologias-extendidas/:id', eliminarTipologiaExtendida);
```

### PASO 4: Pruebas

Después de hacer los cambios, probar:

1. **Riesgos**:
   - Crear riesgo con tipologías 3 y 4
   - Editar tipologías de un riesgo existente
   - Verificar que se muestran correctamente

2. **Causas**:
   - Crear causa sin control ni plan
   - Editar causa
   - Verificar que no se envía `gestion` ni `tipoGestion`

3. **Controles**:
   - Crear control en una causa
   - Verificar recálculo residual
   - Verificar que se guardan los nuevos campos

4. **Planes**:
   - Crear plan de acción
   - Cambiar estado del plan
   - Verificar historial de estados
   - Verificar alertas de vencimiento

5. **Tipologías Extendidas**:
   - Listar tipologías
   - Crear nueva tipología nivel 3
   - Crear nueva tipología nivel 4
   - Editar tipología
   - Intentar eliminar tipología en uso (debe fallar)

### PASO 5: Eliminar Columnas Obsoletas (SOLO DESPUÉS DE PRUEBAS EXITOSAS)

Una vez que todo funcione correctamente, ejecutar en la base de datos:

```sql
BEGIN;

-- Eliminar columnas obsoletas de CausaRiesgo
ALTER TABLE "CausaRiesgo" DROP COLUMN IF EXISTS "tipoGestion";
ALTER TABLE "CausaRiesgo" DROP COLUMN IF EXISTS "gestion";
DROP INDEX IF EXISTS "CausaRiesgo_tipoGestion_idx";

-- Eliminar columnas obsoletas de Riesgo
ALTER TABLE "Riesgo" DROP COLUMN IF EXISTS "tipologiaTipo3";
ALTER TABLE "Riesgo" DROP COLUMN IF EXISTS "tipologiaTipo4";

-- Eliminar columna obsoleta de Proceso
ALTER TABLE "Proceso" DROP COLUMN IF EXISTS "gerencia";

-- Eliminar columna obsoleta de Usuario
ALTER TABLE "Usuario" DROP COLUMN IF EXISTS "role";

COMMIT;
```

## 📊 Verificación Final

Ejecutar estas queries para verificar que todo está correcto:

```sql
-- Verificar que no hay causas con gestion
SELECT COUNT(*) as causas_con_gestion FROM "CausaRiesgo" WHERE "gestion" IS NOT NULL;
-- Debe dar error "column does not exist" si ya se eliminó

-- Verificar planes migrados
SELECT COUNT(*) FROM "PlanAccion" WHERE "origenMigracion" = true;

-- Verificar historial migrado
SELECT COUNT(*) FROM "HistorialEstadoPlan" WHERE "origenMigracion" = true;

-- Verificar tipologías extendidas
SELECT COUNT(*) FROM "TipologiaRiesgoExtendida";

-- Verificar riesgos con tipologías por ID
SELECT COUNT(*) FROM "Riesgo" WHERE "tipologiaTipo3Id" IS NOT NULL;
SELECT COUNT(*) FROM "Riesgo" WHERE "tipologiaTipo4Id" IS NOT NULL;
```

## ⚠️ IMPORTANTE

- Hacer BACKUP de la base de datos antes de cualquier cambio
- Probar primero en ambiente de desarrollo
- No eliminar columnas hasta estar 100% seguro
- Mantener el script SQL de migración para referencia futura
