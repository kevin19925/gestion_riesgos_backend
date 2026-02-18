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
        const { usuarioId } = req.body;
        
        if (!usuarioId) {
            return res.status(400).json({ error: 'usuarioId es requerido' });
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
            where: { id: Number(usuarioId) }
        });
        
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        // Crear la relación (si ya existe, no falla por el unique constraint)
        const procesoResponsable = await prisma.procesoResponsable.upsert({
            where: {
                procesoId_usuarioId: {
                    procesoId,
                    usuarioId: Number(usuarioId)
                }
            },
            update: {},
            create: {
                procesoId,
                usuarioId: Number(usuarioId)
            },
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
        
        res.json({
            id: procesoResponsable.id,
            procesoId: procesoResponsable.procesoId,
            usuario: procesoResponsable.usuario,
            createdAt: procesoResponsable.createdAt
        });
    } catch (error: any) {
        console.error('[BACKEND] Error in addResponsableToProceso:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'El usuario ya es responsable de este proceso' });
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
        
        await prisma.procesoResponsable.delete({
            where: {
                procesoId_usuarioId: {
                    procesoId,
                    usuarioId
                }
            }
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
 */
export const updateResponsablesProceso = async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        const { responsablesIds } = req.body; // Array de IDs de usuarios
        
        if (!Array.isArray(responsablesIds)) {
            return res.status(400).json({ error: 'responsablesIds debe ser un array' });
        }
        
        // Verificar que el proceso existe
        const proceso = await prisma.proceso.findUnique({
            where: { id: procesoId }
        });
        
        if (!proceso) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }
        
        // Verificar que todos los usuarios existen
        const usuariosIds = responsablesIds.map((id: any) => Number(id));
        const usuarios = await prisma.usuario.findMany({
            where: { id: { in: usuariosIds } }
        });
        
        if (usuarios.length !== usuariosIds.length) {
            return res.status(400).json({ error: 'Uno o más usuarios no existen' });
        }
        
        // Eliminar todos los responsables actuales y crear los nuevos
        await prisma.$transaction([
            prisma.procesoResponsable.deleteMany({
                where: { procesoId }
            }),
            ...usuariosIds.map((usuarioId: number) =>
                prisma.procesoResponsable.create({
                    data: {
                        procesoId,
                        usuarioId
                    }
                })
            )
        ]);
        
        // Obtener los responsables actualizados
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
            }
        });
        
        res.json(responsables.map(r => ({
            id: r.id,
            procesoId: r.procesoId,
            usuario: r.usuario,
            createdAt: r.createdAt
        })));
    } catch (error) {
        console.error('[BACKEND] Error in updateResponsablesProceso:', error);
        res.status(500).json({ error: 'Error al actualizar responsables' });
    }
};

