import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * CONTEXTO CONTROLLER
 * Gestiona contexto interno y externo por proceso
 */

export const getContextoByProceso = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    const tipo = req.query.tipo as string | undefined;
    
    let where: any = { procesoId };
    if (tipo === 'interno' || tipo === 'externo') {
      where.tipo = tipo;
    }
    
    const contexto = await prisma.contexto.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    // Agrupar por tipo si no se pasa un filtro
    if (!tipo) {
      const agrupado = {
        interno: contexto.filter(c => c.tipo === 'interno'),
        externo: contexto.filter(c => c.tipo === 'externo')
      };
      return res.json(agrupado);
    }
    
    res.json(contexto);
  } catch (error) {
    console.error('[BACKEND] Error in getContextoByProceso:', error);
    res.status(500).json({ error: 'Error fetching contexto' });
  }
};

export const getContextoById = async (req: Request, res: Response) => {
  try {
    const contextoId = Number(req.params.id);
    
    const contexto = await prisma.contexto.findUnique({
      where: { id: contextoId }
    });
    
    if (!contexto) {
      return res.status(404).json({ error: 'Contexto not found' });
    }
    
    res.json(contexto);
  } catch (error) {
    console.error('[BACKEND] Error in getContextoById:', error);
    res.status(500).json({ error: 'Error fetching contexto' });
  }
};

export const createContexto = async (req: Request, res: Response) => {
  try {
    const {
      procesoId,
      tipo,
      descripcion
    } = req.body;
    
    if (!procesoId || !tipo || !descripcion) {
      return res.status(400).json({
        error: 'Se requieren: procesoId, tipo (interno|externo), descripcion'
      });
    }
    
    if (!['interno', 'externo'].includes(tipo)) {
      return res.status(400).json({
        error: 'tipo debe ser: interno o externo'
      });
    }
    
    const contexto = await prisma.contexto.create({
      data: {
        procesoId: Number(procesoId),
        tipo,
        descripcion
      }
    });
    
    res.status(201).json(contexto);
  } catch (error) {
    console.error('[BACKEND] Error in createContexto:', error);
    res.status(500).json({ error: 'Error creating contexto' });
  }
};

export const updateContexto = async (req: Request, res: Response) => {
  try {
    const contextoId = Number(req.params.id);
    const {
      descripcion,
      tipo
    } = req.body;
    
    const contexto = await prisma.contexto.update({
      where: { id: contextoId },
      data: {
        ...(descripcion && { descripcion }),
        ...(tipo && { tipo })
      }
    });
    
    res.json(contexto);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Contexto not found' });
    }
    console.error('[BACKEND] Error in updateContexto:', error);
    res.status(500).json({ error: 'Error updating contexto' });
  }
};

export const deleteContexto = async (req: Request, res: Response) => {
  try {
    const contextoId = Number(req.params.id);
    
    await prisma.contexto.delete({
      where: { id: contextoId }
    });
    
    res.json({ message: 'Contexto deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Contexto not found' });
    }
    console.error('[BACKEND] Error in deleteContexto:', error);
    res.status(500).json({ error: 'Error deleting contexto' });
  }
};

// Resumen de contexto por proceso
export const getContextoResumen = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    
    const contexto = await prisma.contexto.findMany({
      where: { procesoId }
    });
    
    const resumen = {
      total: contexto.length,
      interno: contexto.filter(c => c.tipo === 'interno').length,
      externo: contexto.filter(c => c.tipo === 'externo').length
    };
    
    res.json(resumen);
  } catch (error) {
    console.error('[BACKEND] Error in getContextoResumen:', error);
    res.status(500).json({ error: 'Error fetching contexto resumen' });
  }
};
