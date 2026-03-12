import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';

const CACHE_KEY_AREAS = 'catalogos:areas';
const CACHE_TTL = 300;

export const getAreas = async (req: Request, res: Response) => {
    try {
        const cached = await redisGet<any>(CACHE_KEY_AREAS);
        if (cached) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.json(cached);
        }
        const areas = await prisma.area.findMany({
            select: {
                id: true,
                nombre: true,
                descripcion: true,
                directorId: true,
                activo: true,
                createdAt: true,
                updatedAt: true,
                director: { select: { id: true, nombre: true } }
            }
        });
        const transformed = areas.map((a: any) => ({
            ...a,
            directorNombre: a.director?.nombre ?? null
        }));
        await redisSet(CACHE_KEY_AREAS, transformed, CACHE_TTL);
        res.setHeader('Cache-Control', 'public, max-age=300');
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
        await redisDel(CACHE_KEY_AREAS);
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

        const area = await prisma.area.update({ where: { id }, data });
        await redisDel(CACHE_KEY_AREAS);
        res.json(area);
    } catch (error: any) {
        if (error?.code === 'P2025') return res.status(404).json({ error: 'Área no encontrada' });
        if (error?.code === 'P2002') return res.status(409).json({ error: 'No se puede actualizar: ya existe otra área con el mismo nombre.' });
        res.status(500).json({ error: 'Error al actualizar el área' });
    }
};

export const deleteArea = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.area.delete({ where: { id } });
        await redisDel(CACHE_KEY_AREAS);
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
