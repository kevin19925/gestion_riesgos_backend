import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * NORMATIVIDAD CONTROLLER
 * Gestiona requisitos normativos por proceso
 */

export const getNormatividadByProceso = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    
    const normatividad = await prisma.normatividad.findMany({
      where: { procesoId },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(normatividad);
  } catch (error) {
    console.error('[BACKEND] Error in getNormatividadByProceso:', error);
    res.status(500).json({ error: 'Error fetching normatividad' });
  }
};

export const getNormatividadById = async (req: Request, res: Response) => {
  try {
    const normatividadId = Number(req.params.id);
    
    const normatividad = await prisma.normatividad.findUnique({
      where: { id: normatividadId }
    });
    
    if (!normatividad) {
      return res.status(404).json({ error: 'Normatividad not found' });
    }
    
    res.json(normatividad);
  } catch (error) {
    console.error('[BACKEND] Error in getNormatividadById:', error);
    res.status(500).json({ error: 'Error fetching normatividad' });
  }
};

export const createNormatividad = async (req: Request, res: Response) => {
  try {
    const {
      procesoId,
      nombre,
      descripcion,
      estado = 'Existente',
      cumplimiento = 'Total'
    } = req.body;
    
    if (!procesoId || !nombre) {
      return res.status(400).json({
        error: 'Se requieren: procesoId, nombre'
      });
    }
    
    const normatividad = await prisma.normatividad.create({
      data: {
        procesoId: Number(procesoId),
        nombre,
        numero: 1,
        estado,
        cumplimiento
      }
    });
    
    res.status(201).json(normatividad);
  } catch (error) {
    console.error('[BACKEND] Error in createNormatividad:', error);
    res.status(500).json({ error: 'Error creating normatividad' });
  }
};

export const updateNormatividad = async (req: Request, res: Response) => {
  try {
    const normatividadId = Number(req.params.id);
    const {
      nombre,
      descripcion,
      estado,
      nivelCumplimiento,
      fechaVencimiento,
      responsable
    } = req.body;
    
    const normatividad = await prisma.normatividad.update({
      where: { id: normatividadId },
      data: {
        ...(nombre && { nombre }),
        ...(estado && { estado })
      }
    });
    
    res.json(normatividad);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Normatividad not found' });
    }
    console.error('[BACKEND] Error in updateNormatividad:', error);
    res.status(500).json({ error: 'Error updating normatividad' });
  }
};

export const deleteNormatividad = async (req: Request, res: Response) => {
  try {
    const normatividadId = Number(req.params.id);
    
    await prisma.normatividad.delete({
      where: { id: normatividadId }
    });
    
    res.json({ message: 'Normatividad deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Normatividad not found' });
    }
    console.error('[BACKEND] Error in deleteNormatividad:', error);
    res.status(500).json({ error: 'Error deleting normatividad' });
  }
};

export const getNormatividadEstadisticas = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.query.procesoId);
    
    const normatividad = await prisma.normatividad.findMany({
      where: procesoId ? { procesoId } : {}
    });
    
    const cumplidas = normatividad.filter(n => n.estado === 'Cumplido').length;
    const incumplidas = normatividad.filter(n => n.estado === 'Incumplido').length;
    const parciales = normatividad.filter(n => n.estado === 'Parcial').length;
    
    const nivelPromedio = normatividad.length > 0
      ? normatividad.reduce((sum, n) => sum + (n.cumplimiento === 'Total' ? 100 : n.cumplimiento === 'Parcial' ? 50 : 0), 0) / normatividad.length
      : 0;
    
    res.json({
      total: normatividad.length,
      cumplidas,
      incumplidas,
      parciales,
      nivelPromedioCumplimiento: nivelPromedio
    });
  } catch (error) {
    console.error('[BACKEND] Error in getNormatividadEstadisticas:', error);
    res.status(500).json({ error: 'Error fetching estadisticas' });
  }
};
