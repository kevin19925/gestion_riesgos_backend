import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * Obtener asistentes de un proceso
 * GET /procesos/:id/asistentes
 */
export const getAsistentesProceso = async (req: Request, res: Response) => {
    const procesoId = Number(req.params.id);
    
    try {
        // Obtener usuarios asignados al proceso con rol de dueño_procesos o supervisor_riesgos
        const asistentes = await prisma.asistentesProceso.findMany({
            where: { procesoId },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true,
                        roleRelacion: {
                            select: {
                                codigo: true,
                                nombre: true
                            }
                        }
                    }
                }
            }
        });

        const asistentesFormateados = asistentes.map(a => ({
            id: a.usuario.id,
            nombre: a.usuario.nombre,
            email: a.usuario.email,
            rol: a.rol,
            createdAt: a.createdAt
        }));

        res.json(asistentesFormateados);
    } catch (error) {
        console.error('[reuniones/getAsistentesProceso]', error);
        res.status(500).json({ error: 'Error al obtener asistentes del proceso' });
    }
};

/**
 * Asignar asistentes a un proceso
 * POST /procesos/:id/asistentes
 * Body: { usuariosIds: number[] }
 */
export const asignarAsistentesProceso = async (req: Request, res: Response) => {
    const procesoId = Number(req.params.id);
    const { usuariosIds } = req.body;

    try {
        if (!Array.isArray(usuariosIds)) {
            return res.status(400).json({ error: 'usuariosIds debe ser un array' });
        }

        // Eliminar asistentes anteriores
        await prisma.asistentesProceso.deleteMany({
            where: { procesoId }
        });

        // Crear nuevos asistentes
        const asistentes = await Promise.all(
            usuariosIds.map(async (usuarioId) => {
                // Obtener el rol del usuario
                const usuario = await prisma.usuario.findUnique({
                    where: { id: usuarioId },
                    include: {
                        roleRelacion: {
                            select: { codigo: true }
                        }
                    }
                });

                if (!usuario) return null;

                const rol = usuario.roleRelacion.codigo === 'dueño_procesos' 
                    ? 'dueño_procesos' 
                    : 'supervisor_riesgos';

                return prisma.asistentesProceso.create({
                    data: {
                        procesoId,
                        usuarioId,
                        rol
                    }
                });
            })
        );

        res.json(asistentes.filter(a => a !== null));
    } catch (error) {
        console.error('[reuniones/asignarAsistentesProceso]', error);
        res.status(500).json({ error: 'Error al asignar asistentes' });
    }
};

/**
 * Obtener reuniones de un proceso
 * GET /procesos/:id/reuniones
 */
export const getReuniones = async (req: Request, res: Response) => {
    const procesoId = Number(req.params.id);

    try {
        const reuniones = await prisma.reunionProceso.findMany({
            where: { procesoId },
            orderBy: { fecha: 'desc' }
        });

        res.json(reuniones);
    } catch (error) {
        console.error('[reuniones/getReuniones]', error);
        res.status(500).json({ error: 'Error al obtener reuniones' });
    }
};

/**
 * Crear una reunión
 * POST /procesos/:id/reuniones
 * Body: { fecha: string, descripcion: string, estado: string }
 */
export const crearReunion = async (req: Request, res: Response) => {
    const procesoId = Number(req.params.id);
    const { fecha, descripcion, estado } = req.body;

    try {
        if (!fecha || !descripcion) {
            return res.status(400).json({ error: 'Fecha y descripción son requeridos' });
        }

        const reunion = await prisma.reunionProceso.create({
            data: {
                procesoId,
                fecha: new Date(fecha),
                descripcion,
                estado: estado || 'programada'
            }
        });

        // Crear registros de asistencia para todos los asistentes del proceso
        const asistentes = await prisma.asistentesProceso.findMany({
            where: { procesoId }
        });

        await Promise.all(
            asistentes.map(asistente =>
                prisma.asistenciaReunion.create({
                    data: {
                        reunionId: reunion.id,
                        usuarioId: asistente.usuarioId,
                        asistio: false
                    }
                })
            )
        );

        res.json(reunion);
    } catch (error) {
        console.error('[reuniones/crearReunion]', error);
        res.status(500).json({ error: 'Error al crear reunión' });
    }
};

/**
 * Actualizar una reunión
 * PUT /reuniones/:id
 * Body: { fecha?: string, descripcion?: string, estado?: string }
 */
export const actualizarReunion = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { fecha, descripcion, estado } = req.body;

    try {
        const updateData: any = {};
        if (fecha) updateData.fecha = new Date(fecha);
        if (descripcion) updateData.descripcion = descripcion;
        if (estado) updateData.estado = estado;

        const reunion = await prisma.reunionProceso.update({
            where: { id },
            data: updateData
        });

        res.json(reunion);
    } catch (error) {
        console.error('[reuniones/actualizarReunion]', error);
        res.status(500).json({ error: 'Error al actualizar reunión' });
    }
};

/**
 * Eliminar una reunión
 * DELETE /reuniones/:id
 */
export const eliminarReunion = async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    try {
        // Eliminar asistencias primero
        await prisma.asistenciaReunion.deleteMany({
            where: { reunionId: id }
        });

        // Eliminar reunión
        await prisma.reunionProceso.delete({
            where: { id }
        });

        res.json({ message: 'Reunión eliminada exitosamente' });
    } catch (error) {
        console.error('[reuniones/eliminarReunion]', error);
        res.status(500).json({ error: 'Error al eliminar reunión' });
    }
};

/**
 * Obtener asistencias de una reunión
 * GET /reuniones/:id/asistencias
 */
export const getAsistencias = async (req: Request, res: Response) => {
    const reunionId = Number(req.params.id);

    console.log('[getAsistencias] Solicitando asistencias para reunión ID:', reunionId);

    try {
        const asistencias = await prisma.asistenciaReunion.findMany({
            where: { reunionId },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true
                    }
                }
            }
        });

        console.log('[getAsistencias] Asistencias encontradas:', asistencias.length);
        console.log('[getAsistencias] Datos:', JSON.stringify(asistencias, null, 2));

        res.json(asistencias);
    } catch (error) {
        console.error('[reuniones/getAsistencias]', error);
        res.status(500).json({ error: 'Error al obtener asistencias' });
    }
};

/**
 * Actualizar asistencias de una reunión
 * PUT /reuniones/:id/asistencias
 * Body: { asistencias: Array<{ id: number, asistio: boolean }> }
 */
export const actualizarAsistencias = async (req: Request, res: Response) => {
    const reunionId = Number(req.params.id);
    const { asistencias } = req.body;

    try {
        if (!Array.isArray(asistencias)) {
            return res.status(400).json({ error: 'asistencias debe ser un array' });
        }

        const updated = await Promise.all(
            asistencias.map(a =>
                prisma.asistenciaReunion.update({
                    where: { id: a.id },
                    data: { 
                        asistio: a.asistio,
                        registradoEn: new Date()
                    }
                })
            )
        );

        res.json(updated);
    } catch (error) {
        console.error('[reuniones/actualizarAsistencias]', error);
        res.status(500).json({ error: 'Error al actualizar asistencias' });
    }
};
