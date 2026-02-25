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
            modo: (r as any).modo || null, // Usar 'as any' temporalmente hasta que se agregue el campo a la BD
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
        
        // Validar modo si se proporciona
        if (modo && !['dueño', 'supervisor', 'ambos'].includes(modo)) {
            return res.status(400).json({ error: 'modo debe ser "dueño", "supervisor" o "ambos"' });
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
        
        // Si el usuario es gerente y se proporciona modo, validar
        const esGerente = usuario.role?.codigo === 'gerente';
        if (esGerente && !modo) {
            return res.status(400).json({ error: 'Para usuarios gerentes, el modo (dueño o supervisor) es requerido' });
        }
        
        // Crear la relación (si ya existe, actualizar el modo)
        const procesoResponsable = await prisma.procesoResponsable.upsert({
            where: {
                procesoId_usuarioId: {
                    procesoId,
                    usuarioId: Number(usuarioId)
                }
            },
            update: {
                ...(esGerente && modo ? { modo: modo as any } : {})
            },
            create: {
                procesoId,
                usuarioId: Number(usuarioId),
                ...(esGerente && modo ? { modo: modo as any } : {})
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
            modo: (procesoResponsable as any).modo || null, // Usar 'as any' temporalmente hasta que se agregue el campo a la BD
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
 * Acepta: { responsables: [{ usuarioId: number, modo?: 'dueño' | 'supervisor' }] }
 * O: { responsablesIds: number[] } (compatibilidad hacia atrás)
 */
export const updateResponsablesProceso = async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        const { responsables, responsablesIds } = req.body;
        
        // Verificar que el proceso existe
        const proceso = await prisma.proceso.findUnique({
            where: { id: procesoId }
        });
        
        if (!proceso) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }
        
        let responsablesData: Array<{ usuarioId: number; modo?: string | null }> = [];
        
        // Compatibilidad: aceptar tanto el nuevo formato como el antiguo
        if (Array.isArray(responsables)) {
            // Nuevo formato: [{ usuarioId, modo }]
            responsablesData = responsables.map((r: any) => ({
                usuarioId: Number(r.usuarioId),
                modo: r.modo && ['dueño', 'supervisor', 'ambos'].includes(r.modo) ? r.modo : (r.modo === null ? null : undefined)
            }));
        } else if (Array.isArray(responsablesIds)) {
            // Formato antiguo: solo IDs
            responsablesData = responsablesIds.map((id: any) => ({
                usuarioId: Number(id),
                modo: null
            }));
        } else {
            return res.status(400).json({ error: 'Debe proporcionar "responsables" o "responsablesIds"' });
        }
        
        // Verificar que todos los usuarios existen y obtener sus roles
        const usuariosIds = responsablesData.map(r => r.usuarioId);
        // Usar Set para obtener IDs únicos (un usuario puede aparecer múltiples veces con diferentes modos)
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
        
        // Validar y normalizar los modos
        for (const responsableData of responsablesData) {
            const usuario = usuarios.find(u => u.id === responsableData.usuarioId);
            const esGerente = usuario?.role?.codigo === 'gerente';
            
            if (esGerente) {
                // Si es gerente y tiene modo "ambos", mantenerlo
                // Si no tiene modo o es inválido, usar 'ambos' por defecto
                if (!responsableData.modo || !['dueño', 'supervisor', 'ambos'].includes(responsableData.modo)) {
                    responsableData.modo = 'ambos';
                }
            } else {
                // Si no es gerente, modo debe ser null
                responsableData.modo = null;
            }
        }
        
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
                        ...(r.modo ? { modo: r.modo as any } : {})
                    } as any
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
            modo: (r as any).modo || null,
            createdAt: r.createdAt
        })));
    } catch (error) {
        console.error('[BACKEND] Error in updateResponsablesProceso:', error);
        res.status(500).json({ error: 'Error al actualizar responsables' });
    }
};

