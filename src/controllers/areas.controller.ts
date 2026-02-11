import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAreas = async (req: Request, res: Response) => {
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
        res.status(500).json({ error: 'Error fetching areas' });
    }
};

export const getAreaById = async (req: Request, res: Response) => {
    const { id } = req.params;
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
        res.status(500).json({ error: 'Error fetching area' });
    }
};

export const createArea = async (req: Request, res: Response) => {
    try {
        const area = await prisma.area.create({
            data: req.body
        });
        res.status(201).json(area);
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({ error: 'Error creating area' });
    }
};

export const updateArea = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const area = await prisma.area.update({
            where: { id },
            data: req.body
        });
        res.json(area);
    } catch (error) {
        res.status(500).json({ error: 'Error updating area' });
    }
};

export const deleteArea = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.area.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting area' });
    }
};
