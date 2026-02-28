import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';

const CACHE_TTL_BENCHMARKING = 120; // 2 min

export const getBenchmarkingByProceso = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId || req.query.procesoId);
    if (!procesoId) {
      return res.status(400).json({ error: 'procesoId is required' });
    }
    const cacheKey = `benchmarking:proceso:${procesoId}`;
    const cached = await redisGet<any[]>(cacheKey);
    if (cached) return res.json(cached);
    const items = await prisma.benchmarking.findMany({
      where: { procesoId },
      orderBy: { createdAt: 'asc' }
    });
    await redisSet(cacheKey, items, CACHE_TTL_BENCHMARKING);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching benchmarking' });
  }
};

export const setBenchmarkingByProceso = async (req: Request, res: Response) => {
  try {
    const procesoId = Number(req.params.procesoId);
    if (!procesoId) {
      return res.status(400).json({ error: 'procesoId is required' });
    }
    const data = Array.isArray(req.body) ? req.body : [];

    await prisma.$transaction([
      prisma.benchmarking.deleteMany({ where: { procesoId } }),
      prisma.benchmarking.createMany({
        data: data.map((item: any) => ({
          procesoId,
          empresa: item.empresa,
          numero: item.numero ?? null,
          riesgo: item.riesgo,
          clasificacion: item.clasificacion ?? null,
          calificacion: item.calificacion ?? null,
          entidad: item.empresa ?? item.entidad ?? null,
          indicador: item.riesgo ?? item.indicador ?? null,
          valor: item.valor ?? null,
          comparacion: item.comparacion ?? null,
        }))
      })
    ]);

    const items = await prisma.benchmarking.findMany({
      where: { procesoId },
      orderBy: { createdAt: 'asc' }
    });
    const cacheKey = `benchmarking:proceso:${procesoId}`;
    await redisDel(cacheKey);
    await redisSet(cacheKey, items, CACHE_TTL_BENCHMARKING);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error saving benchmarking' });
  }
};

export const deleteBenchmarkingItem = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.benchmarking.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting benchmarking item' });
  }
};
