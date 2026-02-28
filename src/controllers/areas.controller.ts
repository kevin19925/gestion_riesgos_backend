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
    const id = Number(req.params.id);
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
            data: {
                ...req.body,
                directorId: req.body.directorId ? Number(req.body.directorId) : null
            }
        });
        res.status(201).json(area);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'No se puede crear el área: ya existe una con el mismo nombre.' });
        }
        res.status(500).json({ error: 'Error al crear el área' });
    }
};

export const updateArea = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const data = { ...req.body };
        if (data.directorId) data.directorId = Number(data.directorId);

        const area = await prisma.area.update({
            where: { id },
            data
        });
        res.json(area);
    } catch (error: any) {
        if (error?.code === 'P2025') {
            return res.status(404).json({ error: 'Área no encontrada' });
        }
        if (error?.code === 'P2002') {
            return res.status(409).json({ error: 'No se puede actualizar: ya existe otra área con el mismo nombre.' });
        }
        res.status(500).json({ error: 'Error al actualizar el área' });
    }
};

export const deleteArea = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.area.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error: any) {
        if (error?.code === 'P2025') {
            return res.status(404).json({ error: 'Área no encontrada' });
        }
        if (error?.code === 'P2003') {
            return res.status(400).json({ error: 'No se puede eliminar el área: tiene procesos asociados.' });
        }
        res.status(500).json({ error: 'Error al eliminar el área' });
    }
};
