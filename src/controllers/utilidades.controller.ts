import { Request, Response } from 'express';
import prisma from '../prisma';

// ============================================
// OBSERVACIONES
// ============================================
export const getObservaciones = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    console.log(`[BACKEND] getObservaciones - procesoId: ${procesoId}`);
    try {
        const where = procesoId ? { procesoId: Number(procesoId) } : {};
        const observations = await prisma.observacion.findMany({
            where,
            include: { autor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(observations);
    } catch (error) {
        console.error('[BACKEND] Error in getObservaciones:', error);
        res.status(500).json({ error: 'Error fetching observations' });
    }
};

export const createObservacion = async (req: Request, res: Response) => {
    console.log('[BACKEND] createObservacion - body:', JSON.stringify(req.body, null, 2));
    try {
        const observation = await prisma.observacion.create({
            data: {
                ...req.body,
                procesoId: Number(req.body.procesoId),
                autorId: Number(req.body.autorId)
            },
            include: { autor: true }
        });
        res.json(observation);
    } catch (error) {
        console.error('[BACKEND] Error in createObservacion:', error);
        res.status(500).json({ error: 'Error creating observation' });
    }
};

// ============================================
// HISTORIAL
// ============================================
export const getHistorial = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    console.log(`[BACKEND] getHistorial - procesoId: ${procesoId}`);
    try {
        const where = procesoId ? { procesoId: Number(procesoId) } : {};
        const history = await prisma.historialCambioProceso.findMany({
            where,
            include: { usuario: true },
            orderBy: { fecha: 'desc' }
        });
        res.json(history);
    } catch (error) {
        console.error('[BACKEND] Error in getHistorial:', error);
        res.status(500).json({ error: 'Error fetching history' });
    }
};

// ============================================
// TAREAS
// ============================================
export const getTareas = async (req: Request, res: Response) => {
    const { usuarioId } = req.query;
    console.log(`[BACKEND] getTareas - usuarioId: ${usuarioId}`);
    try {
        const where = usuarioId ? { usuarioId: Number(usuarioId) } : {};
        const tasks = await prisma.tarea.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(tasks);
    } catch (error) {
        console.error('[BACKEND] Error in getTareas:', error);
        res.status(500).json({ error: 'Error fetching tasks' });
    }
};

export const createTarea = async (req: Request, res: Response) => {
    console.log('[BACKEND] createTarea - body:', JSON.stringify(req.body, null, 2));
    try {
        const task = await prisma.tarea.create({
            data: {
                ...req.body,
                usuarioId: Number(req.body.usuarioId)
            }
        });
        res.json(task);
    } catch (error) {
        console.error('[BACKEND] Error in createTarea:', error);
        res.status(500).json({ error: 'Error creating task' });
    }
};

// ============================================
// NOTIFICACIONES
// ============================================
export const getNotificaciones = async (req: Request, res: Response) => {
    const { usuarioId } = req.query;
    console.log(`[BACKEND] getNotificaciones - usuarioId: ${usuarioId}`);
    try {
        const where = usuarioId ? { usuarioId: Number(usuarioId) } : {};
        const notifications = await prisma.notificacion.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch (error) {
        console.error('[BACKEND] Error in getNotificaciones:', error);
        res.status(500).json({ error: 'Error fetching notifications' });
    }
};
