import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';

const CACHE_KEY_CONFIG_ACTIVA = 'calificacion-inherente:activa';
const CACHE_TTL_CONFIG_ACTIVA = 300; // 5 min

/**
 * CALIFICACIÓN INHERENTE CONTROLLER
 * Gestiona la configuración de calificación inherente
 */

// Obtener configuración activa (con caché Redis para no demorar Identificación)
export const getConfigActiva = async (_req: Request, res: Response) => {
  try {
    const cached = await redisGet(CACHE_KEY_CONFIG_ACTIVA);
    if (cached) return res.json(cached);
    const config = await prisma.calificacionInherenteConfig.findFirst({
      where: { activa: true },
      include: {
        formulaBase: true,
        excepciones: {
          where: { activa: true },
          orderBy: { prioridad: 'asc' }
        },
        rangos: {
          where: { activo: true },
          orderBy: { orden: 'asc' }
        },
        reglaAgregacion: true,
        mapaConfig: true
      }
    });

    if (!config) {
      return res.status(404).json({ error: 'No hay configuración activa' });
    }
    await redisSet(CACHE_KEY_CONFIG_ACTIVA, config, CACHE_TTL_CONFIG_ACTIVA);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching active config' });
  }
};

// Obtener todas las configuraciones
export const getAllConfigs = async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.calificacionInherenteConfig.findMany({
      include: {
        formulaBase: true,
        excepciones: {
          orderBy: { prioridad: 'asc' }
        },
        rangos: {
          orderBy: { orden: 'asc' }
        },
        reglaAgregacion: true,
        mapaConfig: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching configs' });
  }
};

// Obtener configuración por ID
export const getConfigById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await prisma.calificacionInherenteConfig.findUnique({
      where: { id: Number(id) },
      include: {
        formulaBase: true,
        excepciones: {
          orderBy: { prioridad: 'asc' }
        },
        rangos: {
          orderBy: { orden: 'asc' }
        },
        reglaAgregacion: true,
        mapaConfig: true
      }
    });

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching config' });
  }
};

// Crear nueva configuración
export const createConfig = async (req: Request, res: Response) => {
  try {
    const { nombre, descripcion, activa, mapaConfigId, formulaBase, excepciones, rangos, reglaAgregacion } = req.body;

    // Si se marca como activa, desactivar las demás
    if (activa) {
      await prisma.calificacionInherenteConfig.updateMany({
        where: { activa: true },
        data: { activa: false }
      });
    }

    const config = await prisma.calificacionInherenteConfig.create({
      data: {
        nombre,
        descripcion,
        activa: activa || false,
        mapaConfigId: mapaConfigId || null,
        formulaBase: formulaBase ? {
          create: {
            tipoOperacion: formulaBase.tipoOperacion || 'multiplicacion',
            campos: formulaBase.campos || [],
            orden: formulaBase.orden || 1
          }
        } : undefined,
        excepciones: excepciones && Array.isArray(excepciones) ? {
          create: excepciones.map((exc: any) => ({
            condiciones: exc.condiciones,
            resultado: exc.resultado,
            prioridad: exc.prioridad || 1,
            activa: exc.activa !== false
          }))
        } : undefined,
        rangos: rangos && Array.isArray(rangos) ? {
          create: rangos.map((rango: any) => ({
            nivelNombre: rango.nivelNombre,
            valorMinimo: rango.valorMinimo,
            valorMaximo: rango.valorMaximo,
            incluirMinimo: rango.incluirMinimo !== false,
            incluirMaximo: rango.incluirMaximo !== false,
            orden: rango.orden,
            activo: rango.activo !== false
          }))
        } : undefined,
        reglaAgregacion: reglaAgregacion ? {
          create: {
            tipoAgregacion: reglaAgregacion.tipoAgregacion || 'maximo',
            tablaOrigen: reglaAgregacion.tablaOrigen || 'CausaRiesgo',
            campoOrigen: reglaAgregacion.campoOrigen || 'calificacionInherente'
          }
        } : undefined
      },
      include: {
        formulaBase: true,
        excepciones: true,
        rangos: true,
        reglaAgregacion: true
      }
    });

    await redisDel(CACHE_KEY_CONFIG_ACTIVA);
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error creating config' });
  }
};

// Actualizar configuración
export const updateConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activa, mapaConfigId, formulaBase, excepciones, rangos, reglaAgregacion } = req.body;

    // Si se marca como activa, desactivar las demás
    if (activa) {
      await prisma.calificacionInherenteConfig.updateMany({
        where: { activa: true, id: { not: Number(id) } },
        data: { activa: false }
      });
    }

    // Actualizar configuración base
    const config = await prisma.calificacionInherenteConfig.update({
      where: { id: Number(id) },
      data: {
        nombre,
        descripcion,
        activa,
        mapaConfigId: mapaConfigId || null
      }
    });

    // Actualizar fórmula base
    if (formulaBase) {
      await prisma.formulaCalificacionInherente.upsert({
        where: { configId: Number(id) },
        create: {
          configId: Number(id),
          tipoOperacion: formulaBase.tipoOperacion || 'multiplicacion',
          campos: formulaBase.campos || [],
          orden: formulaBase.orden || 1
        },
        update: {
          tipoOperacion: formulaBase.tipoOperacion,
          campos: formulaBase.campos,
          orden: formulaBase.orden
        }
      });
    }

    // Actualizar excepciones (eliminar todas y recrear)
    if (excepciones !== undefined) {
      await prisma.excepcionCalificacion.deleteMany({
        where: { configId: Number(id) }
      });
      
      if (Array.isArray(excepciones) && excepciones.length > 0) {
        await prisma.excepcionCalificacion.createMany({
          data: excepciones.map((exc: any) => ({
            configId: Number(id),
            condiciones: exc.condiciones,
            resultado: exc.resultado,
            prioridad: exc.prioridad || 1,
            activa: exc.activa !== false
          }))
        });
      }
    }

    // Actualizar rangos (eliminar todos y recrear)
    if (rangos !== undefined) {
      await prisma.rangoCalificacion.deleteMany({
        where: { configId: Number(id) }
      });
      
      if (Array.isArray(rangos) && rangos.length > 0) {
        await prisma.rangoCalificacion.createMany({
          data: rangos.map((rango: any) => ({
            configId: Number(id),
            nivelNombre: rango.nivelNombre,
            valorMinimo: rango.valorMinimo,
            valorMaximo: rango.valorMaximo,
            incluirMinimo: rango.incluirMinimo !== false,
            incluirMaximo: rango.incluirMaximo !== false,
            orden: rango.orden,
            activo: rango.activo !== false
          }))
        });
      }
    }

    // Actualizar regla de agregación
    if (reglaAgregacion) {
      await prisma.reglaAgregacionCalificacion.upsert({
        where: { configId: Number(id) },
        create: {
          configId: Number(id),
          tipoAgregacion: reglaAgregacion.tipoAgregacion || 'maximo',
          tablaOrigen: reglaAgregacion.tablaOrigen || 'CausaRiesgo',
          campoOrigen: reglaAgregacion.campoOrigen || 'calificacionInherente'
        },
        update: {
          tipoAgregacion: reglaAgregacion.tipoAgregacion,
          tablaOrigen: reglaAgregacion.tablaOrigen,
          campoOrigen: reglaAgregacion.campoOrigen
        }
      });
    }

    // Obtener configuración actualizada
    const updated = await prisma.calificacionInherenteConfig.findUnique({
      where: { id: Number(id) },
      include: {
        formulaBase: true,
        excepciones: {
          orderBy: { prioridad: 'asc' }
        },
        rangos: {
          orderBy: { orden: 'asc' }
        },
        reglaAgregacion: true
      }
    });

    await redisDel(CACHE_KEY_CONFIG_ACTIVA);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating config' });
  }
};

// Eliminar configuración
export const deleteConfig = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.calificacionInherenteConfig.delete({
      where: { id: Number(id) }
    });

    res.json({ message: 'Config deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting config' });
  }
};

// Calcular calificación inherente usando la configuración activa
export const calcularCalificacionInherente = async (req: Request, res: Response) => {
  try {
    const { frecuencia, calificacionGlobalImpacto } = req.body;

    // Obtener configuración activa
    const config = await prisma.calificacionInherenteConfig.findFirst({
      where: { activa: true },
      include: {
        formulaBase: true,
        excepciones: {
          where: { activa: true },
          orderBy: { prioridad: 'asc' }
        },
        rangos: {
          where: { activo: true },
          orderBy: { orden: 'desc' } // De mayor a menor para evaluar primero los rangos más altos
        }
      }
    });

    if (!config || !config.formulaBase) {
      return res.status(404).json({ error: 'No hay configuración activa' });
    }

    let resultado = 0;

    // Aplicar excepciones primero
    let excepcionAplicada = false;
    for (const excepcion of config.excepciones) {
      const condiciones = excepcion.condiciones as any;
      if (condiciones.frecuencia === frecuencia && condiciones.calificacionGlobalImpacto === calificacionGlobalImpacto) {
        resultado = excepcion.resultado;
        excepcionAplicada = true;
        break;
      }
    }

    // Si no se aplicó excepción, aplicar fórmula base
    if (!excepcionAplicada) {
      if (config.formulaBase.tipoOperacion === 'multiplicacion') {
        resultado = frecuencia * calificacionGlobalImpacto;
      } else if (config.formulaBase.tipoOperacion === 'suma') {
        resultado = frecuencia + calificacionGlobalImpacto;
      } else if (config.formulaBase.tipoOperacion === 'promedio') {
        resultado = (frecuencia + calificacionGlobalImpacto) / 2;
      }
    }

    // Determinar nivel de riesgo según rangos
    let nivelRiesgo = 'Sin Calificar';
    for (const rango of config.rangos) {
      const cumpleMinimo = rango.incluirMinimo 
        ? resultado >= rango.valorMinimo 
        : resultado > rango.valorMinimo;
      const cumpleMaximo = rango.incluirMaximo 
        ? resultado <= rango.valorMaximo 
        : resultado < rango.valorMaximo;
      
      if (cumpleMinimo && cumpleMaximo) {
        nivelRiesgo = rango.nivelNombre;
        break;
      }
    }

    res.json({
      resultado,
      nivelRiesgo,
      configuracion: {
        formula: config.formulaBase.tipoOperacion,
        excepcionAplicada
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error calculating inherent qualification' });
  }
};

