import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAreas = async (req: Request, res: Response) => {
    console.log('[BACKEND] getAreas');
    try {
        const areas = await prisma.area.findMany({
            include: { director: true }
        });
        // Transform to return directorNombre
        const transformed = areas.map((a: any) => ({
            ...a,
            directorNombre: a.director?.nombre
        }));
        res.json(transformed);
    } catch (error) {
        console.error('[BACKEND] Error in getAreas:', error);
        res.status(500).json({ error: 'Error fetching areas' });
    }
};

export const getAreaById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] getAreaById - id: ${id}`);
    try {
        const area = await prisma.area.findUnique({
            where: { id },
            include: { director: true }
        });
        if (!area) return res.status(404).json({ error: 'Area not found' });
        res.json({
            ...area,
            directorNombre: area.director?.nombre
        });
    } catch (error) {
        console.error('[BACKEND] Error in getAreaById:', error);
        res.status(500).json({ error: 'Error fetching area' });
    }
};

export const createArea = async (req: Request, res: Response) => {
    console.log('[BACKEND] createArea - body:', JSON.stringify(req.body, null, 2));
    try {
        const area = await prisma.area.create({
            data: {
                ...req.body,
                directorId: req.body.directorId ? Number(req.body.directorId) : null
            }
        });
        res.status(201).json(area);
    } catch (error) {
        console.error('[BACKEND] Error creating area:', error);
        res.status(500).json({ error: 'Error creating area' });
    }
};

export const updateArea = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] updateArea - id: ${id}, body:`, JSON.stringify(req.body, null, 2));
    try {
        const data = { ...req.body };
        if (data.directorId) data.directorId = Number(data.directorId);

        const area = await prisma.area.update({
            where: { id },
            data
        });
        res.json(area);
    } catch (error) {
        console.error('[BACKEND] Error updating area:', error);
        res.status(500).json({ error: 'Error updating area' });
    }
};

export const deleteArea = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] deleteArea - id: ${id}`);
    try {
        await prisma.area.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        console.error('[BACKEND] Error deleting area:', error);
        res.status(500).json({ error: 'Error deleting area' });
    }
};
