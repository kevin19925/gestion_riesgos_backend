import { Request, Response } from 'express';
import prisma from '../prisma';
import { obtenerHistorial } from '../services/audit.service';

// ============================================
// OBSERVACIONES
// ============================================
const OBSERVACIONES_LIMIT = 500;

export const getObservaciones = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    try {
        const where = procesoId ? { procesoId: Number(procesoId) } : {};
        const observations = await prisma.observacion.findMany({
            where,
            take: OBSERVACIONES_LIMIT,
            select: {
                id: true,
                procesoId: true,
                texto: true,
                tipo: true,
                createdAt: true,
                updatedAt: true,
                autorId: true,
                autor: { select: { id: true, nombre: true, email: true } }
            },
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
            data: {
                ...req.body,
                procesoId: Number(req.body.procesoId),
                autorId: Number(req.body.autorId)
            },
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
    try {
        const { usuarioId, tabla, accion, fechaDesde, fechaHasta, page, pageSize } = req.query;

        const filtros: any = {};

        if (usuarioId) filtros.usuarioId = parseInt(usuarioId as string);
        if (tabla) filtros.tabla = tabla as string;
        if (accion) filtros.accion = accion as string;
        if (fechaDesde) filtros.fechaDesde = new Date(fechaDesde as string);
        if (fechaHasta) filtros.fechaHasta = new Date(fechaHasta as string);
        if (page) filtros.page = parseInt(page as string);
        if (pageSize) filtros.pageSize = parseInt(pageSize as string);

        const resultado = await obtenerHistorial(filtros);
        res.json(resultado.data);
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
};

