import { Request, Response } from 'express';
import prisma from '../prisma';

export const getEvaluacionesByRiesgo = async (req: Request, res: Response) => {
    const riesgoId = Number(req.params.riesgoId);
    console.log(`[BACKEND] getEvaluacionesByRiesgo - riesgoId: ${riesgoId}`);
    try {
        const evaluacion = await prisma.evaluacionRiesgo.findUnique({
            where: { riesgoId }
        });
        // Return as array for compatibility
        res.json(evaluacion ? [evaluacion] : []);
    } catch (error) {
        console.error('[BACKEND] Error in getEvaluacionesByRiesgo:', error);
        res.status(500).json({ error: 'Error fetching evaluaciones' });
    }
};

export const createEvaluacion = async (req: Request, res: Response) => {
    console.log('[BACKEND] createEvaluacion - body:', JSON.stringify(req.body, null, 2));
    const { riesgoId, ...data } = req.body;
    const rId = Number(riesgoId);
    try {
        const evaluacion = await prisma.evaluacionRiesgo.create({
            data: {
                ...data,
                riesgoId: rId,
            }
        });
        res.json(evaluacion);
    } catch (error) {
        console.warn(`[BACKEND] Error creating evaluacion, attempting update: ${rId}`);
        // If it exists, update it? Or return 409
        try {
            const existing = await prisma.evaluacionRiesgo.findUnique({ where: { riesgoId: rId } });
            if (existing) {
                const updated = await prisma.evaluacionRiesgo.update({
                    where: { riesgoId: rId },
                    data
                });
                return res.json(updated);
            }
        } catch (innerError) {
            console.error('[BACKEND] Error updating existing evaluacion:', innerError);
        }

        console.error('[BACKEND] Final error in createEvaluacion:', error);
        res.status(500).json({ error: 'Error creating evaluacion' });
    }
};
