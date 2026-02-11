import { Request, Response } from 'express';
import prisma from '../prisma';

// ============================================
// OBSERVACIONES
// ============================================
export const getObservaciones = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    try {
        const where = procesoId ? { procesoId: String(procesoId) } : {};
        const observations = await prisma.observacion.findMany({
            where,
            include: { autor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(observations);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching observations' });
    }
};

export const createObservacion = async (req: Request, res: Response) => {
    try {
        const observation = await prisma.observacion.create({
            data: req.body,
            include: { autor: true }
        });
        res.json(observation);
    } catch (error) {
        res.status(500).json({ error: 'Error creating observation' });
    }
};

// ============================================
// HISTORIAL
// ============================================
export const getHistorial = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    try {
        const where = procesoId ? { procesoId: String(procesoId) } : {};
        const history = await prisma.historialCambioProceso.findMany({
            where,
            include: { usuario: true },
            orderBy: { fecha: 'desc' }
        });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching history' });
    }
};

// ============================================
// TAREAS
// ============================================
export const getTareas = async (req: Request, res: Response) => {
    const { usuarioId } = req.query;
    try {
        const where = usuarioId ? { usuarioId: String(usuarioId) } : {};
        const tasks = await prisma.tarea.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching tasks' });
    }
};

export const createTarea = async (req: Request, res: Response) => {
    try {
        const task = await prisma.tarea.create({
            data: req.body
        });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: 'Error creating task' });
    }
};

// ============================================
// NOTIFICACIONES
// ============================================
export const getNotificaciones = async (req: Request, res: Response) => {
    const { usuarioId } = req.query;
    try {
        const where = usuarioId ? { usuarioId: String(usuarioId) } : {};
        const notifications = await prisma.notificacion.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching notifications' });
    }
};
