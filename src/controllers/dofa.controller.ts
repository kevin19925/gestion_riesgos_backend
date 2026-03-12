import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';

/**
 * DOFA CONTROLLER
 * Gestiona matriz DOFA (Fortalezas, Oportunidades, Debilidades, Amenazas)
 */

const DOFA_CACHE_TTL = 60; // 1 minuto

export const getDofaByProceso = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    if (!procesoId || isNaN(procesoId)) {
      return res.status(400).json({ error: 'procesoId inválido' });
    }

    const cacheKey = `dofa:proceso:${procesoId}`;
    const cached = await redisGet<any>(cacheKey);
    if (cached) return res.json(cached);

    const dofa = await prisma.dofaItem.findMany({
      where: { procesoId },
      select: { id: true, tipo: true, descripcion: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    const tipoLower = (t: string) => t?.toLowerCase() ?? '';
    const agrupado = {
      fortalezas: dofa.filter(d => tipoLower(d.tipo) === 'fortaleza'),
      oportunidades: dofa.filter(d => tipoLower(d.tipo) === 'oportunidad'),
      debilidades: dofa.filter(d => tipoLower(d.tipo) === 'debilidad'),
      amenazas: dofa.filter(d => tipoLower(d.tipo) === 'amenaza')
    };

    await redisSet(cacheKey, agrupado, DOFA_CACHE_TTL);
    res.json(agrupado);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching DOFA' });
  }
};

async function invalidarCacheDofaProceso(procesoId: number): Promise<void> {
  await redisDel(`dofa:proceso:${procesoId}`).catch(() => {});
}

export const getDofaElementoById = async (req: Request, res: Response) => {
  try {
    const dofaId = Number(req.params.id);
    const dofa = await prisma.dofaItem.findUnique({
      where: { id: dofaId },
      select: { id: true, procesoId: true, tipo: true, descripcion: true, createdAt: true, updatedAt: true }
    });
    if (!dofa) return res.status(404).json({ error: 'DOFA element not found' });
    res.json(dofa);
  } catch (error) {
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
      data: { procesoId: Number(procesoId), tipo, descripcion }
    });
    await invalidarCacheDofaProceso(Number(procesoId));
    res.status(201).json(dofa);
  } catch (error) {
    res.status(500).json({ error: 'Error creating DOFA element' });
  }
};

export const updateDofaElemento = async (req: Request, res: Response) => {
  try {
    const dofaId = Number(req.params.id);
    const { descripcion } = req.body;
    const dofa = await prisma.dofaItem.update({
      where: { id: dofaId },
      data: { ...(descripcion && { descripcion }) }
    });
    await invalidarCacheDofaProceso(dofa.procesoId);
    res.json(dofa);
  } catch (error) {
    if ((error as any).code === 'P2025') return res.status(404).json({ error: 'DOFA element not found' });
    res.status(500).json({ error: 'Error updating DOFA element' });
  }
};

export const deleteDofaElemento = async (req: Request, res: Response) => {
  try {
    const dofaId = Number(req.params.id);
    const dofa = await prisma.dofaItem.findUnique({ where: { id: dofaId }, select: { procesoId: true } });
    await prisma.dofaItem.delete({ where: { id: dofaId } });
    if (dofa) await invalidarCacheDofaProceso(dofa.procesoId);
    res.json({ message: 'DOFA element deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') return res.status(404).json({ error: 'DOFA element not found' });
    res.status(500).json({ error: 'Error deleting DOFA element' });
  }
};

