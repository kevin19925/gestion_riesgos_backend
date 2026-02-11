import { Request, Response } from 'express';
import prisma from '../prisma';

export const getEvaluacionesByRiesgo = async (req: Request, res: Response) => {
    const { riesgoId } = req.params;
    try {
        const evaluacion = await prisma.evaluacionRiesgo.findUnique({
            where: { riesgoId }
        });
        // Return as array for compatibility
        res.json(evaluacion ? [evaluacion] : []);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching evaluaciones' });
    }
};

export const createEvaluacion = async (req: Request, res: Response) => {
    const { riesgoId, ...data } = req.body;
    try {
        const evaluacion = await prisma.evaluacionRiesgo.create({
            data: {
                riesgoId,
                ...data,
            }
        });
        res.json(evaluacion);
    } catch (error) {
        // If it exists, update it? Or return 409
        // Try upsert logic if safer
        const existing = await prisma.evaluacionRiesgo.findUnique({ where: { riesgoId } });
        if (existing) {
            const updated = await prisma.evaluacionRiesgo.update({
                where: { riesgoId },
                data
            });
            return res.json(updated);
        }

        res.status(500).json({ error: 'Error creating evaluacion' });
    }
};
