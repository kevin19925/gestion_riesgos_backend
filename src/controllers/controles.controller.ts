import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * CONTROLES CONTROLLER
 * Gestiona controles asociados a riesgos
 * ⭐ IMPORTANTE: Calcula efectividad y riesgo residual server-side
 */

// Helper: Calcular efectividad basado en diseño, ejecución, solidez
function calcularEfectividad(diseño: number, ejecucion: number, solidez: number): number {
  const total = diseño + ejecucion + solidez;
  const efectividad = total / 15; // máximo es 15 (5+5+5)
  return Math.min(1, Math.max(0, efectividad)); // Limitar 0-1
}

// Helper: Calcular riesgo residual
function calcularRiesgoResidual(riesgoInherente: number, efectividad: number): number {
  return riesgoInherente - (riesgoInherente * efectividad);
}

// Helper: Clasificar riesgo por valor numérico
function clasificarRiesgo(valor: number): string {
  if (valor <= 25) return 'BAJO';
  if (valor <= 50) return 'MEDIO';
  if (valor <= 75) return 'ALTO';
  return 'CRÍTICO';
}

export const getControlesByRiesgo = async (req: Request, res: Response) => {
  try {
    const riesgoId = Number(req.params.riesgoId);
    
    const controles = await prisma.control.findMany({
      where: { riesgoId },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(controles);
  } catch (error) {
    console.error('[BACKEND] Error in getControlesByRiesgo:', error);
    res.status(500).json({ error: 'Error fetching controles' });
  }
};

export const getControlById = async (req: Request, res: Response) => {
  try {
    const controlId = Number(req.params.id);
    
    const control = await prisma.control.findUnique({
      where: { id: controlId }
    });
    
    if (!control) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    res.json(control);
  } catch (error) {
    console.error('[BACKEND] Error in getControlById:', error);
    res.status(500).json({ error: 'Error fetching control' });
  }
};

export const createControl = async (req: Request, res: Response) => {
  try {
    const { riesgoId, diseño, ejecucion, solidez, descripcion, tipoControl } = req.body;
    
    if (!riesgoId || diseño === undefined || ejecucion === undefined || solidez === undefined) {
      return res.status(400).json({
        error: 'Requeridos: riesgoId, diseño, ejecucion, solidez'
      });
    }
    
    // 1. Obtener evaluación del riesgo para riesgoInherente
    const evaluacion = await prisma.evaluacionRiesgo.findUnique({
      where: { riesgoId: Number(riesgoId) }
    });
    
    if (!evaluacion) {
      return res.status(404).json({
        error: 'Evaluación del riesgo no encontrada. Primero debe calificar el riesgo.'
      });
    }
    
    // 2. Calcular efectividad
    const efectividad = calcularEfectividad(diseño, ejecucion, solidez);
    
    // 3. Calcular riesgo residual
    const riesgoInherente = evaluacion.riesgoInherente || 0;
    const riesgoResidual = calcularRiesgoResidual(riesgoInherente, efectividad);
    const clasificacionResidual = clasificarRiesgo(riesgoResidual);
    
    // 4. Crear control
    const control = await prisma.control.create({
      data: {
        riesgoId: Number(riesgoId),
        descripcion: descripcion || '',
        tipoControl: tipoControl || 'preventivo',
        diseño: Number(diseño),
        ejecucion: Number(ejecucion),
        solidez: Number(solidez),
        efectividad,
        riesgoResidual,
        clasificacionResidual
      }
    });
    
    console.log('[BACKEND] Control created with automatic calculations:', {
      id: control.id,
      efectividad: control.efectividad,
      riesgoResidual: control.riesgoResidual,
      clasificacionResidual: control.clasificacionResidual
    });
    
    res.status(201).json(control);
  } catch (error) {
    console.error('[BACKEND] Error in createControl:', error);
    res.status(500).json({ error: 'Error creating control' });
  }
};

export const updateControl = async (req: Request, res: Response) => {
  try {
    const controlId = Number(req.params.id);
    const { diseño, ejecucion, solidez, descripcion, tipoControl } = req.body;
    
    // Obtener control actual
    const controlActual = await prisma.control.findUnique({
      where: { id: controlId }
    });
    
    if (!controlActual) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    // Nuevos valores o mantener los actuales
    const nuevoDiseno = diseño !== undefined ? diseño : controlActual.diseño;
    const nuevoEjecucion = ejecucion !== undefined ? ejecucion : controlActual.ejecucion;
    const nuevoSolidez = solidez !== undefined ? solidez : controlActual.solidez;
    
    // Recalcular si cambiaron valores
    let nuevoEfectividad = controlActual.efectividad;
    let nuevoRiesgoResidual = controlActual.riesgoResidual;
    let nuevoClasificacion = controlActual.clasificacionResidual;
    
    if (diseño !== undefined || ejecucion !== undefined || solidez !== undefined) {
      nuevoEfectividad = calcularEfectividad(nuevoDiseno, nuevoEjecucion, nuevoSolidez);
      
      // Obtener riesgo inherente
      const evaluacion = await prisma.evaluacionRiesgo.findUnique({
        where: { riesgoId: controlActual.riesgoId }
      });
      
      const riesgoInherente = evaluacion?.riesgoInherente || 0;
      nuevoRiesgoResidual = calcularRiesgoResidual(riesgoInherente, nuevoEfectividad);
      nuevoClasificacion = clasificarRiesgo(nuevoRiesgoResidual);
    }
    
    // Actualizar control
    const control = await prisma.control.update({
      where: { id: controlId },
      data: {
        ...(descripcion !== undefined && { descripcion }),
        ...(tipoControl !== undefined && { tipoControl }),
        diseño: nuevoDiseno,
        ejecucion: nuevoEjecucion,
        solidez: nuevoSolidez,
        efectividad: nuevoEfectividad,
        riesgoResidual: nuevoRiesgoResidual,
        clasificacionResidual: nuevoClasificacion
      }
    });
    
    console.log('[BACKEND] Control updated with recalculation:', {
      id: control.id,
      efectividad: control.efectividad,
      riesgoResidual: control.riesgoResidual,
      clasificacionResidual: control.clasificacionResidual
    });
    
    res.json(control);
  } catch (error) {
    console.error('[BACKEND] Error in updateControl:', error);
    res.status(500).json({ error: 'Error updating control' });
  }
};

export const deleteControl = async (req: Request, res: Response) => {
  try {
    const controlId = Number(req.params.id);
    
    await prisma.control.delete({
      where: { id: controlId }
    });
    
    res.json({ message: 'Control deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Control not found' });
    }
    console.error('[BACKEND] Error in deleteControl:', error);
    res.status(500).json({ error: 'Error deleting control' });
  }
};

export const getEfectividadPromedio = async (req: Request, res: Response) => {
  try {
    const riesgoId = Number(req.params.riesgoId);
    
    const controles = await prisma.control.findMany({
      where: { riesgoId }
    });
    
    if (controles.length === 0) {
      return res.json({
        riesgoId,
        cantidadControles: 0,
        efectividadPromedio: 0,
        riesgoResiduales: []
      });
    }
    
    const efectividadPromedio = controles.reduce((sum, c) => sum + c.efectividad, 0) / controles.length;
    
    res.json({
      riesgoId,
      cantidadControles: controles.length,
      efectividadPromedio,
      controles: controles.map(c => ({
        id: c.id,
        efectividad: c.efectividad,
        riesgoResidual: c.riesgoResidual
      }))
    });
  } catch (error) {
    console.error('[BACKEND] Error in getEfectividadPromedio:', error);
    res.status(500).json({ error: 'Error fetching efectividad' });
  }
};
