import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * DOFA CONTROLLER
 * Gestiona matriz DOFA (Fortalezas, Oportunidades, Debilidades, Amenazas)
 */

export const getDofaByProceso = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    
    const dofa = await prisma.dofaItem.findMany({
      where: { procesoId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Agrupar por tipo
    const agrupado = {
      fortalezas: dofa.filter(d => d.tipo === 'fortaleza'),
      oportunidades: dofa.filter(d => d.tipo === 'oportunidad'),
      debilidades: dofa.filter(d => d.tipo === 'debilidad'),
      amenazas: dofa.filter(d => d.tipo === 'amenaza')
    };
    
    res.json(agrupado);
  } catch (error) {
    console.error('[BACKEND] Error in getDofaByProceso:', error);
    res.status(500).json({ error: 'Error fetching DOFA' });
  }
};

export const getDofaElementoById = async (req: Request, res: Response) => {
  try {
    const dofaId = Number(req.params.id);
    
    const dofa = await prisma.dofaItem.findUnique({
      where: { id: dofaId }
    });
    
    if (!dofa) {
      return res.status(404).json({ error: 'DOFA element not found' });
    }
    
    res.json(dofa);
  } catch (error) {
    console.error('[BACKEND] Error in getDofaElementoById:', error);
    res.status(500).json({ error: 'Error fetching DOFA element' });
  }
};

export const createDofaElemento = async (req: Request, res: Response) => {
  try {
    const { procesoId, tipo, descripcion, impacto, probabilidad } = req.body;
    
    if (!procesoId || !tipo || !descripcion) {
      return res.status(400).json({
        error: 'Se requieren: procesoId, tipo (fortaleza|oportunidad|debilidad|amenaza), descripcion'
      });
    }
    
    if (!['fortaleza', 'oportunidad', 'debilidad', 'amenaza'].includes(tipo)) {
      return res.status(400).json({
        error: 'tipo debe ser: fortaleza, oportunidad, debilidad o amenaza'
      });
    }
    
    const dofa = await prisma.dofaItem.create({
      data: {
        procesoId: Number(procesoId),
        tipo,
        descripcion
      }
    });
    
    res.status(201).json(dofa);
  } catch (error) {
    console.error('[BACKEND] Error in createDofaElemento:', error);
    res.status(500).json({ error: 'Error creating DOFA element' });
  }
};

export const updateDofaElemento = async (req: Request, res: Response) => {
  try {
    const dofaId = Number(req.params.id);
    const { descripcion, impacto, probabilidad } = req.body;
    
    const dofa = await prisma.dofaItem.update({
      where: { id: dofaId },
      data: {
        ...(descripcion && { descripcion })
      }
    });
    
    res.json(dofa);
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'DOFA element not found' });
    }
    console.error('[BACKEND] Error in updateDofaElemento:', error);
    res.status(500).json({ error: 'Error updating DOFA element' });
  }
};

export const deleteDofaElemento = async (req: Request, res: Response) => {
  try {
    const dofaId = Number(req.params.id);
    
    await prisma.dofaItem.delete({
      where: { id: dofaId }
    });
    
    res.json({ message: 'DOFA element deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'DOFA element not found' });
    }
    console.error('[BACKEND] Error in deleteDofaElemento:', error);
    res.status(500).json({ error: 'Error deleting DOFA element' });
  }
};

// FO, FA, DO, DA - Estrategias cruzadas
export const getDofaEstrategias = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    
    const dofa = await prisma.dofaItem.findMany({
      where: { procesoId }
    });
    
    const fortalezas = dofa.filter(d => d.tipo === 'FORTALEZA');
    const oportunidades = dofa.filter(d => d.tipo === 'OPORTUNIDAD');
    const debilidades = dofa.filter(d => d.tipo === 'DEBILIDAD');
    const amenazas = dofa.filter(d => d.tipo === 'AMENAZA');
    
    const estrategias = {
      FO: {
        nombre: 'Estrategias Ofensivas (Fortalezas + Oportunidades)',
        descripcion: 'Aprovechar fortalezas para capturar oportunidades',
        items: fortalezas.map(f => ({ fortaleza: f.descripcion, oportunidades: oportunidades.map(o => o.descripcion) }))
      },
      FA: {
        nombre: 'Estrategias Defensivas (Fortalezas + Amenazas)',
        descripcion: 'Usar fortalezas para enfrentar amenazas',
        items: fortalezas.map(f => ({ fortaleza: f.descripcion, amenazas: amenazas.map(a => a.descripcion) }))
      },
      DO: {
        nombre: 'Estrategias de Mejora (Debilidades + Oportunidades)',
        descripcion: 'Mejorar debilidades para capturar oportunidades',
        items: debilidades.map(d => ({ debilidad: d.descripcion, oportunidades: oportunidades.map(o => o.descripcion) }))
      },
      DA: {
        nombre: 'Estrategias de Supervivencia (Debilidades + Amenazas)',
        descripcion: 'Minimizar debilidades y amenazas',
        items: debilidades.map(d => ({ debilidad: d.descripcion, amenazas: amenazas.map(a => a.descripcion) }))
      }
    };
    
    res.json(estrategias);
  } catch (error) {
    console.error('[BACKEND] Error in getDofaEstrategias:', error);
    res.status(500).json({ error: 'Error fetching DOFA estrategias' });
  }
};
