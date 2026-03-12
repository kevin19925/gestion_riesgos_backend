import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';
import { getDeleteErrorMessage } from '../utils/prismaErrors';

const CACHE_KEY_GERENCIAS = 'catalogos:gerencias';
const CACHE_TTL = 300;

export const getGerencias = async (req: Request, res: Response) => {
    try {
        const cached = await redisGet<any>(CACHE_KEY_GERENCIAS);
        if (cached) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.json(cached);
        }
        const gerencias = await prisma.gerencia.findMany({
            select: { id: true, nombre: true, subdivision: true, createdAt: true, updatedAt: true }
        });
        await redisSet(CACHE_KEY_GERENCIAS, gerencias, CACHE_TTL);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(gerencias);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching gerencias' });
    }
};

export const getGerenciaById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const gerencia = await prisma.gerencia.findUnique({
            where: { id }
        });
        if (!gerencia) return res.status(404).json({ error: 'Gerencia not found' });
        res.json(gerencia);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching gerencia' });
    }
};

export const createGerencia = async (req: Request, res: Response) => {
    try {
        const gerencia = await prisma.gerencia.create({ data: req.body });
        await redisDel(CACHE_KEY_GERENCIAS);
        res.status(201).json(gerencia);
    } catch (error) {
        res.status(500).json({ error: 'Error creating gerencia' });
    }
};

export const updateGerencia = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const gerencia = await prisma.gerencia.update({ where: { id }, data: req.body });
        await redisDel(CACHE_KEY_GERENCIAS);
        res.json(gerencia);
    } catch (error) {
        res.status(500).json({ error: 'Error updating gerencia' });
    }
};

export const deleteGerencia = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.gerencia.delete({ where: { id } });
        await redisDel(CACHE_KEY_GERENCIAS);
        res.status(204).send();
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'gerencia', 'usuarios o cargos asociados');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};
