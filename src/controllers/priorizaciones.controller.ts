import { Request, Response } from 'express';
import prisma from '../prisma';

export const getPriorizaciones = async (req: Request, res: Response) => {
    try {
        const priorizaciones = await prisma.priorizacionRiesgo.findMany({
            include: { planesAccion: true }
        });
        res.json(priorizaciones);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching priorizaciones' });
    }
};

export const createPriorizacion = async (req: Request, res: Response) => {
    const { riesgoId, ...data } = req.body;
    try {
        const priorizacion = await prisma.priorizacionRiesgo.upsert({
            where: { riesgoId },
            update: data,
            create: { ...data, riesgoId }
        });
        res.json(priorizacion);
    } catch (error) {
        res.status(500).json({ error: 'Error creating priorizacion' });
    }
};
