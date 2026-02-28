/**
 * Controller para gestionar múltiples responsables por proceso
 */

import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * GET /api/procesos/:procesoId/responsables
 * Obtener todos los responsables de un proceso
 */
export const getResponsablesByProceso = async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        
        const responsables = await prisma.procesoResponsable.findMany({
            where: { procesoId },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true,
                        role: true,
                        cargo: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        
        res.json(responsables.map(r => ({
            id: r.id,
            procesoId: r.procesoId,
            usuario: r.usuario,
            modo: r.modo,
            createdAt: r.createdAt
        })));
    } catch (error) {
        console.error('[BACKEND] Error in getResponsablesByProceso:', error);
        res.status(500).json({ error: 'Error fetching responsables' });
    }
};

/**
 * POST /api/procesos/:procesoId/responsables
 * Agregar un responsable a un proceso
 */
export const addResponsableToProceso = async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        const { usuarioId, modo } = req.body;
        
        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId es requerido' });
        }
        
        // Validar modo (ahora es obligatorio)
        if (!modo || !['director', 'proceso'].includes(modo)) {
            return res.status(400).json({ error: 'modo es requerido y debe ser "director" o "proceso"' });
        }
        
        // Verificar que el proceso existe
        const proceso = await prisma.proceso.findUnique({
            where: { id: procesoId }
        });
        
        if (!proceso) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }
        
        // Verificar que el usuario existe
        const usuario = await prisma.usuario.findUnique({
            where: { id: Number(usuarioId) },
            include: { role: true }
        });
        
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Buscar si ya existe (procesoId + usuarioId + modo)
        const existente = await prisma.procesoResponsable.findFirst({
            where: { procesoId, usuarioId: Number(usuarioId), modo },
            include: {
                usuario: {
                    select: { id: true, nombre: true, email: true, role: true, cargo: true }
                }
            }
        });

        const procesoResponsable = existente ?? await prisma.procesoResponsable.create({
                data: {
                    procesoId,
                    usuarioId: Number(usuarioId),
                    modo
                },
                include: {
                    usuario: {
                        select: { id: true, nombre: true, email: true, role: true, cargo: true }
                    }
                }
            });

        res.json({
            id: procesoResponsable.id,
            procesoId: procesoResponsable.procesoId,
            usuario: procesoResponsable.usuario,
            modo: procesoResponsable.modo,
            createdAt: procesoResponsable.createdAt
        });
    } catch (error: any) {
        console.error('[BACKEND] Error in addResponsableToProceso:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'El usuario ya es responsable de este proceso en este modo' });
        }
        res.status(500).json({ error: 'Error al agregar responsable' });
    }
};

/**
 * DELETE /api/procesos/:procesoId/responsables/:usuarioId
 * Eliminar un responsable de un proceso
 */
export const removeResponsableFromProceso = async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        const usuarioId = Number(req.params.usuarioId);
        const { modo } = req.body; // Necesitamos el modo para eliminar
        
        if (!modo || !['director', 'proceso'].includes(modo)) {
            return res.status(400).json({ error: 'modo es requerido para eliminar ("director" o "proceso")' });
        }
        
        const row = await prisma.procesoResponsable.findFirst({
            where: { procesoId, usuarioId, modo }
        });
        if (!row) {
            return res.status(404).json({ error: 'Responsable no encontrado' });
        }
        await prisma.procesoResponsable.delete({
            where: { id: row.id }
        });
        
        res.json({ message: 'Responsable eliminado correctamente' });
    } catch (error: any) {
        console.error('[BACKEND] Error in removeResponsableFromProceso:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Responsable no encontrado' });
        }
        res.status(500).json({ error: 'Error al eliminar responsable' });
    }
};

/**
 * PUT /api/procesos/:procesoId/responsables
 * Actualizar la lista completa de responsables de un proceso
 * Acepta: { responsables: [{ usuarioId: number, modo: 'director' | 'proceso' }] }
 */
export const updateResponsablesProceso = async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        const { responsables, responsablesIds } = req.body;
        
        console.log(`[BACKEND] updateResponsablesProceso - Proceso ${procesoId}`);
        console.log('[BACKEND] Body recibido:', JSON.stringify(req.body, null, 2));
        console.log('[BACKEND] Headers:', JSON.stringify(req.headers, null, 2));
        
        // Verificar que el proceso existe
        const proceso = await prisma.proceso.findUnique({
            where: { id: procesoId }
        });
        
        if (!proceso) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }
        
        let responsablesData: Array<{ usuarioId: number; modo: string }> = [];
        
        // Aceptar formato: [{ usuarioId, modo }]
        if (Array.isArray(responsables)) {
            responsablesData = responsables.map((r: any) => ({
                usuarioId: Number(r.usuarioId),
                modo: r.modo
            }));
        } else if (Array.isArray(responsablesIds)) {
            // Formato antiguo no soportado - requiere modo
            return res.status(400).json({ error: 'Debe proporcionar "responsables" con modo "director" o "proceso"' });
        } else {
            return res.status(400).json({ error: 'Debe proporcionar "responsables"' });
        }
        
        // Verificar que todos los usuarios existen
        const usuariosIds = responsablesData.map(r => r.usuarioId);
        const usuariosIdsUnicos = Array.from(new Set(usuariosIds));
        
        const usuarios = await prisma.usuario.findMany({
            where: { id: { in: usuariosIdsUnicos } },
            include: { role: true }
        });
        
        // Validar que todos los IDs únicos existen
        if (usuarios.length !== usuariosIdsUnicos.length) {
            const usuariosEncontradosIds = usuarios.map(u => u.id);
            const usuariosFaltantes = usuariosIdsUnicos.filter(id => !usuariosEncontradosIds.includes(id));
            return res.status(400).json({ 
                error: 'Uno o más usuarios no existen',
                usuariosFaltantes: usuariosFaltantes
            });
        }
        
        // Expandir "ambos" a dos registros separados
        const responsablesExpandidos: Array<{ usuarioId: number; modo: string }> = [];
        for (const responsableData of responsablesData) {
            if (responsableData.modo === 'ambos') {
                // Crear dos registros: uno como director y otro como proceso
                responsablesExpandidos.push({
                    usuarioId: responsableData.usuarioId,
                    modo: 'director'
                });
                responsablesExpandidos.push({
                    usuarioId: responsableData.usuarioId,
                    modo: 'proceso'
                });
            } else if (['director', 'proceso'].includes(responsableData.modo)) {
                responsablesExpandidos.push(responsableData);
            } else {
                console.log('[BACKEND] Modo inválido:', responsableData.modo);
                return res.status(400).json({ 
                    error: 'Cada responsable debe tener modo "director", "proceso" o "ambos"',
                    responsableInvalido: responsableData
                });
            }
        }
        
        // Usar los responsables expandidos en lugar de los originales
        responsablesData = responsablesExpandidos;
        
        // Eliminar todos los responsables actuales y crear los nuevos
        await prisma.$transaction([
            prisma.procesoResponsable.deleteMany({
                where: { procesoId }
            }),
            ...responsablesData.map((r) =>
                prisma.procesoResponsable.create({
                    data: {
                        procesoId,
                        usuarioId: r.usuarioId,
                        modo: r.modo
                    }
                })
            )
        ]);
        
        // Obtener los responsables actualizados
        const responsablesActualizados = await prisma.procesoResponsable.findMany({
            where: { procesoId },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true,
                        role: true,
                        cargo: true
                    }
                }
            }
        });
        
        res.json(responsablesActualizados.map(r => ({
            id: r.id,
            procesoId: r.procesoId,
            usuario: r.usuario,
            modo: r.modo,
            createdAt: r.createdAt
        })));
    } catch (error: any) {
        console.error('[BACKEND] Error in updateResponsablesProceso:', error);
        console.error('[BACKEND] Error stack:', error?.stack);
        console.error('[BACKEND] Error message:', error?.message);
        res.status(500).json({ 
            error: 'Error al actualizar responsables',
            details: error?.message || String(error),
            code: error?.code || 'UNKNOWN'
        });
    }
};

