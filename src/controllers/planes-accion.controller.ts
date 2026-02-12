import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * PLANES DE ACCIÓN CONTROLLER
 * Gestiona planes de acción (preventivos y reactivos)
 */

export const getPlanes = async (_req: Request, res: Response) => {
  try {
    const planes = await prisma.planAccion.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(planes);
  } catch (error) {
    console.error('[BACKEND] Error in getPlanes:', error);
    res.status(500).json({ error: 'Error fetching planes' });
  }
};

export const getPlanesByRiesgo = async (req: Request, res: Response) => {
  try {
    const riesgoId = Number(req.params.riesgoId);
    
    const planes = await prisma.planAccion.findMany({
      where: {
        riesgoId,
        incidenciaId: null  // Preventivos
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(planes);
  } catch (error) {
    console.error('[BACKEND] Error in getPlanesByRiesgo:', error);
    res.status(500).json({ error: 'Error fetching planes' });
  }
};

export const getPlanesByIncidencia = async (req: Request, res: Response) => {
  try {
    const incidenciaId = Number(req.params.incidenciaId);
    
    const planes = await prisma.planAccion.findMany({
      where: {
        incidenciaId,
        riesgoId: null  // Reactivos
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(planes);
  } catch (error) {
    console.error('[BACKEND] Error in getPlanesByIncidencia:', error);
    res.status(500).json({ error: 'Error fetching planes reactivos' });
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    
    const plan = await prisma.planAccion.findUnique({
      where: { id: planId }
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json(plan);
  } catch (error) {
    console.error('[BACKEND] Error in getPlanById:', error);
    res.status(500).json({ error: 'Error fetching plan' });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const {
      riesgoId,
      incidenciaId,
      nombre,
      objetivo,
      descripcion,
      responsable,
      fechaInicio,
      fechaFin,
      fechaProgramada,
      estado = 'Planeado',
      prioridad = 3,
      presupuesto,
      porcentajeAvance,
      observaciones
    } = req.body;
    
    if (!descripcion) {
      return res.status(400).json({ error: 'descripcion is required' });
    }
    
    if (!riesgoId && !incidenciaId) {
      return res.status(400).json({
        error: 'Se requiere riesgoId (preventivo) o incidenciaId (reactivo)'
      });
    }
    
    const plan = await prisma.planAccion.create({
      data: {
        ...(riesgoId && { riesgoId: Number(riesgoId) }),
        ...(incidenciaId && { incidenciaId: Number(incidenciaId) }),
        nombre,
        objetivo,
        descripcion,
        responsable: responsable || '',
        fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
        fechaFin: fechaFin ? new Date(fechaFin) : undefined,
        fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : undefined,
        estado,
        prioridad: Number(prioridad),
        ...(presupuesto !== undefined && { presupuesto: Number(presupuesto) }),
        ...(porcentajeAvance !== undefined && { porcentajeAvance: Number(porcentajeAvance) }),
        observaciones
      }
    });
    
    res.status(201).json(plan);
  } catch (error) {
    console.error('[BACKEND] Error in createPlan:', error);
    res.status(500).json({ error: 'Error creating plan' });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    const {
      descripcion,
      responsable,
      nombre,
      objetivo,
      fechaInicio,
      fechaFin,
      fechaProgramada,
      fechaEjecucion,
      estado,
      prioridad,
      presupuesto,
      porcentajeAvance,
      observaciones
    } = req.body;
    
    const plan = await prisma.planAccion.update({
      where: { id: planId },
      data: {
        ...(nombre && { nombre }),
        ...(objetivo && { objetivo }),
        ...(descripcion && { descripcion }),
        ...(responsable && { responsable }),
        ...(fechaInicio && { fechaInicio: new Date(fechaInicio) }),
        ...(fechaFin && { fechaFin: new Date(fechaFin) }),
        ...(fechaProgramada && { fechaProgramada: new Date(fechaProgramada) }),
        ...(fechaEjecucion && { fechaEjecucion: new Date(fechaEjecucion) }),
        ...(estado && { estado }),
        ...(prioridad !== undefined && { prioridad: Number(prioridad) }),
        ...(presupuesto !== undefined && { presupuesto: Number(presupuesto) }),
        ...(porcentajeAvance !== undefined && { porcentajeAvance: Number(porcentajeAvance) }),
        ...(observaciones && { observaciones })
      }
    });
    
    res.json(plan);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    console.error('[BACKEND] Error in updatePlan:', error);
    res.status(500).json({ error: 'Error updating plan' });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    
    await prisma.planAccion.delete({
      where: { id: planId }
    });
    
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    console.error('[BACKEND] Error in deletePlan:', error);
    res.status(500).json({ error: 'Error deleting plan' });
  }
};

export const getPlanesVencidos = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    
    const planes = await prisma.planAccion.findMany({
      where: {
        AND: [
          { fechaProgramada: { lt: today } },
          { estado: { not: 'Completado' } }
        ]
      }
    });
    
    res.json(planes);
  } catch (error) {
    console.error('[BACKEND] Error in getPlanesVencidos:', error);
    res.status(500).json({ error: 'Error fetching planes vencidos' });
  }
};

export const getPlanesEstadisticas = async (req: Request, res: Response) => {
  try {
    const todos = await prisma.planAccion.findMany();
    
    const estadisticas = {
      total: todos.length,
      porEstado: {
        planeado: todos.filter(p => p.estado === 'Planeado').length,
        enEjecucion: todos.filter(p => p.estado === 'En ejecución').length,
        completado: todos.filter(p => p.estado === 'Completado').length,
        vencido: todos.filter(p => p.estado === 'Vencido').length
      },
      preventivos: todos.filter(p => p.riesgoId && !p.incidenciaId).length,
      reactivos: todos.filter(p => p.incidenciaId && !p.riesgoId).length
    };
    
    res.json(estadisticas);
  } catch (error) {
    console.error('[BACKEND] Error in getPlanesEstadisticas:', error);
    res.status(500).json({ error: 'Error fetching estadisticas' });
  }
};
