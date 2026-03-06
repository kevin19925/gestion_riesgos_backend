# 📘 Ejemplo de Uso: Estrategia SWR (Stale-While-Revalidate)

## ¿Qué es SWR?

SWR es una estrategia de caché que:
1. **Devuelve datos del caché inmediatamente** (aunque estén "viejos")
2. **Refresca el caché en segundo plano** para la próxima petición
3. **El usuario nunca espera** por la base de datos

## Comparación: Antes vs Después

### ❌ ANTES (Caché tradicional)

```typescript
export const getProcesos = async (req: Request, res: Response) => {
    try {
        const cacheKey = 'procesos:all';
        const cached = await redisGet<any>(cacheKey);
        
        // Si hay caché, devolver
        if (cached) return res.json(cached);
        
        // Si no hay caché, consultar DB (USUARIO ESPERA AQUÍ)
        const procesos = await prisma.proceso.findMany({
            include: { area: true }
        });
        
        // Cachear resultado
        await redisSet(cacheKey, procesos, 300);
        
        res.json(procesos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener procesos' });
    }
};
```

**Problema:** 
- Primera petición: Usuario espera 500-1000ms
- Después del TTL: Usuario vuelve a esperar 500-1000ms

---

### ✅ DESPUÉS (Con SWR)

```typescript
import { swrCache } from '../utils/cacheStrategies';

export const getProcesos = async (req: Request, res: Response) => {
    try {
        const data = await swrCache(
            'procesos:all',
            async () => {
                // Esta función solo se ejecuta si no hay caché
                // o en segundo plano para refrescar
                return await prisma.proceso.findMany({
                    include: { area: true }
                });
            },
            300 // TTL: 5 minutos
        );
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener procesos' });
    }
};
```

**Beneficios:**
- Primera petición: Usuario espera 500-1000ms (normal)
- Siguientes peticiones: Usuario espera 0-10ms (del caché)
- Después del TTL: Usuario espera 0-10ms (caché viejo) + refresh en background

---

## Ejemplos Prácticos

### 1. Listado de Procesos (Lectura frecuente)

```typescript
import { swrCache } from '../utils/cacheStrategies';

export const getProcesos = async (req: Request, res: Response) => {
    try {
        const data = await swrCache(
            'procesos:all',
            async () => {
                return await prisma.proceso.findMany({
                    select: {
                        id: true,
                        nombre: true,
                        descripcion: true,
                        areaId: true,
                        estado: true,
                        activo: true,
                        area: {
                            select: {
                                id: true,
                                nombre: true
                            }
                        }
                    },
                    orderBy: { nombre: 'asc' }
                });
            },
            300 // 5 minutos - datos que no cambian frecuentemente
        );
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener procesos' });
    }
};
```

### 2. Estadísticas del Dashboard (Cálculos pesados)

```typescript
import { swrCache } from '../utils/cacheStrategies';

export const getEstadisticas = async (req: Request, res: Response) => {
    try {
        const { procesoId } = req.query;
        const cacheKey = procesoId 
            ? `estadisticas:proceso:${procesoId}` 
            : 'estadisticas:all';
        
        const data = await swrCache(
            cacheKey,
            async () => {
                // Consultas pesadas con agregaciones
                const [totalRiesgos, riesgosPorNivel, riesgosPorTipo] = await Promise.all([
                    prisma.riesgo.count({
                        where: procesoId ? { procesoId: Number(procesoId) } : {}
                    }),
                    prisma.riesgo.groupBy({
                        by: ['nivelRiesgoInherente'],
                        _count: true,
                        where: procesoId ? { procesoId: Number(procesoId) } : {}
                    }),
                    prisma.riesgo.groupBy({
                        by: ['tipoRiesgoId'],
                        _count: true,
                        where: procesoId ? { procesoId: Number(procesoId) } : {}
                    })
                ]);
                
                return {
                    totalRiesgos,
                    riesgosPorNivel,
                    riesgosPorTipo
                };
            },
            120 // 2 minutos - estadísticas pueden estar ligeramente desactualizadas
        );
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
```

### 3. Detalle de un Riesgo (Lectura individual)

```typescript
import { swrCache } from '../utils/cacheStrategies';

export const getRiesgoById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const data = await swrCache(
            `riesgo:${id}`,
            async () => {
                const riesgo = await prisma.riesgo.findUnique({
                    where: { id: Number(id) },
                    include: {
                        proceso: {
                            select: {
                                id: true,
                                nombre: true,
                                area: {
                                    select: {
                                        id: true,
                                        nombre: true
                                    }
                                }
                            }
                        },
                        causas: true,
                        controles: true,
                        planesAccion: true
                    }
                });
                
                if (!riesgo) {
                    throw new Error('Riesgo no encontrado');
                }
                
                return riesgo;
            },
            180 // 3 minutos
        );
        
        res.json(data);
    } catch (error) {
        if (error instanceof Error && error.message === 'Riesgo no encontrado') {
            return res.status(404).json({ error: 'Riesgo no encontrado' });
        }
        res.status(500).json({ error: 'Error al obtener riesgo' });
    }
};
```

### 4. Invalidación de Caché al Actualizar

```typescript
import { swrCache } from '../utils/cacheStrategies';
import { redisSet } from '../redisClient';

export const updateRiesgo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;
        
        // Actualizar en la base de datos
        const updated = await prisma.riesgo.update({
            where: { id: Number(id) },
            data,
            include: {
                proceso: true,
                causas: true,
                controles: true
            }
        });
        
        // IMPORTANTE: Invalidar cachés relacionados
        await Promise.all([
            redisSet(`riesgo:${id}`, null, 0),                    // Caché individual
            redisSet(`riesgos:proceso:${updated.procesoId}`, null, 0), // Listado del proceso
            redisSet('estadisticas:all', null, 0),                // Estadísticas generales
            redisSet(`estadisticas:proceso:${updated.procesoId}`, null, 0) // Estadísticas del proceso
        ]);
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar riesgo' });
    }
};
```

---

## Cuándo Usar SWR vs Caché Simple

### ✅ Usa SWR cuando:
- Los datos se leen frecuentemente
- Los datos no cambian muy seguido
- La experiencia de usuario es crítica
- Puedes tolerar datos ligeramente desactualizados (segundos/minutos)

**Ejemplos:**
- Listados de procesos
- Estadísticas del dashboard
- Catálogos (tipos de riesgo, áreas, etc.)
- Configuraciones del sistema

### ✅ Usa Caché Simple cuando:
- Los datos deben estar siempre actualizados
- Las lecturas no son tan frecuentes
- Los cálculos no son muy pesados

**Ejemplos:**
- Datos de usuario actual
- Permisos y roles
- Configuraciones críticas

### ❌ NO uses caché cuando:
- Los datos cambian en tiempo real
- La consistencia es crítica
- Son operaciones de escritura

**Ejemplos:**
- Crear/actualizar/eliminar registros
- Autenticación
- Transacciones financieras

---

## Configuración de TTL Recomendada

| Tipo de Dato | TTL Recomendado | Razón |
|--------------|-----------------|-------|
| Listados generales (procesos, áreas) | 300s (5 min) | Cambian poco |
| Estadísticas | 120s (2 min) | Pueden estar ligeramente desactualizadas |
| Detalles individuales | 180s (3 min) | Balance entre frescura y rendimiento |
| Catálogos (tipos, estados) | 600s (10 min) | Casi nunca cambian |
| Configuraciones | 300s (5 min) | Cambian raramente |
| Datos de usuario | 60s (1 min) | Deben estar relativamente frescos |

---

## Monitoreo y Debugging

### Ver si el caché está funcionando

Agrega logs temporales:

```typescript
const data = await swrCache(
    'procesos:all',
    async () => {
        console.log('🔄 Consultando DB para procesos...');
        return await prisma.proceso.findMany();
    },
    300
);
console.log('✅ Datos devueltos (caché o DB)');
```

**Resultado esperado:**
- Primera petición: `🔄 Consultando DB...` + `✅ Datos devueltos`
- Siguientes peticiones: Solo `✅ Datos devueltos` (del caché)
- Después del TTL: `✅ Datos devueltos` (caché viejo) + `🔄 Consultando DB...` (background)

---

## Migración Gradual

No necesitas migrar todo de una vez. Empieza con los endpoints más usados:

1. **Fase 1:** Listados principales (procesos, riesgos)
2. **Fase 2:** Estadísticas y dashboards
3. **Fase 3:** Detalles individuales
4. **Fase 4:** Catálogos y configuraciones

Mide el impacto después de cada fase y ajusta los TTL según sea necesario.

---

## Troubleshooting

### Problema: Datos desactualizados por mucho tiempo
**Solución:** Reduce el TTL o invalida el caché al actualizar

### Problema: Caché no se está usando
**Solución:** Verifica que Redis esté configurado y funcionando

### Problema: Memoria de Redis creciendo mucho
**Solución:** Reduce los TTL o limpia cachés viejos periódicamente

---

## Resumen

✅ **SWR = Respuestas instantáneas + Datos frescos en background**

- Usuario feliz (respuestas rápidas)
- Base de datos feliz (menos carga)
- Tú feliz (menos problemas de rendimiento)

¡Empieza a usar SWR hoy y ve la diferencia!
