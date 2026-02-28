import { Request, Response } from 'express';
import prisma from '../prisma';
import { getDeleteErrorMessage } from '../utils/prismaErrors';
import { redisGet, redisSet } from '../redisClient';

export const getProcesos = async (req: Request, res: Response) => {
    try {
        // OPTIMIZADO: Caché Redis para reducir queries repetidas
        const cacheKey = 'procesos:all';
        const cached = await redisGet<any>(cacheKey);
        if (cached) return res.json(cached);

        // OPTIMIZADO: Usar select específico en lugar de include completo
        const procesos = await prisma.proceso.findMany({
            select: {
                id: true,
                nombre: true,
                descripcion: true,
                objetivo: true,
                tipo: true,
                responsableId: true,
                areaId: true,
                vicepresidencia: true,
                gerencia: true,
                estado: true,
                activo: true,
                analisis: true,
                documentoUrl: true,
                documentoNombre: true,
                createdAt: true,
                updatedAt: true,
                sigla: true,
                // OPTIMIZADO: Select específico para responsable (solo campos necesarios)
                responsable: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true
                    }
                },
                // OPTIMIZADO: Select específico para responsables múltiples
                responsables: {
                    select: {
                        modo: true,
                        usuario: {
                            select: {
                                id: true,
                                nombre: true,
                                email: true,
                                role: {
                                    select: {
                                        codigo: true,
                                        nombre: true
                                    }
                                }
                            }
                        }
                    }
                },
                // OPTIMIZADO: Select específico para área
                area: {
                    select: {
                        id: true,
                        nombre: true,
                        director: {
                            select: {
                                id: true,
                                nombre: true,
                                email: true
                            }
                        }
                    }
                },
                // OPTIMIZADO: Limitar participantes a solo campos necesarios
                participantes: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // Mapear para agregar areaNombre y lista de responsables para facilitar uso en frontend
        const procesosConAreaNombre = procesos.map(p => {
            const responsablesList = (p.responsables || []).map((r: any) => {
                const modo = r.modo !== undefined ? r.modo : null;
                return {
                    id: r.usuario.id,
                    nombre: r.usuario.nombre,
                    email: r.usuario.email,
                    role: r.usuario.role?.codigo || null,
                    modo: modo
                };
            });
            
            return {
                ...p,
                areaNombre: p.area?.nombre || null,
                responsablesList: responsablesList
            };
        });
        
        // OPTIMIZADO: Cachear resultado por 5 minutos
        await redisSet(cacheKey, procesosConAreaNombre, 300);
        
        res.json(procesosConAreaNombre);
    } catch (error: any) {
        res.status(500).json({ 
            error: 'Error fetching procesos',
            details: error?.message || String(error)
        });
    }
};

export const getProcesoById = async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // Validate ID exists and is a valid number
    if (!id || id === 'undefined' || id === '') {
        return res.status(400).json({ error: 'Proceso ID is required and must be a valid number' });
    }
    const procesoId = Number(id);
    if (isNaN(procesoId) || procesoId <= 0) {
        return res.status(400).json({ error: 'Invalid proceso ID - must be a positive number' });
    }
    
    try {
        // OPTIMIZADO: Caché por proceso individual
        const cacheKey = `proceso:${procesoId}`;
        const cached = await redisGet<any>(cacheKey);
        if (cached) return res.json(cached);

        // OPTIMIZADO: Usar select específico para reducir datos
        const proceso = await prisma.proceso.findUnique({
            where: { id: procesoId },
            select: {
                id: true,
                nombre: true,
                descripcion: true,
                objetivo: true,
                tipo: true,
                responsableId: true,
                areaId: true,
                vicepresidencia: true,
                gerencia: true,
                estado: true,
                activo: true,
                analisis: true,
                documentoUrl: true,
                documentoNombre: true,
                createdAt: true,
                updatedAt: true,
                sigla: true,
                responsable: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true
                    }
                },
                responsables: {
                    select: {
                        modo: true,
                        usuario: {
                            select: {
                                id: true,
                                nombre: true,
                                email: true
                            }
                        }
                    }
                },
                area: {
                    select: {
                        id: true,
                        nombre: true,
                        director: {
                            select: {
                                id: true,
                                nombre: true,
                                email: true
                            }
                        }
                    }
                },
                // OPTIMIZADO: Limitar riesgos a solo campos básicos
                riesgos: {
                    select: {
                        id: true,
                        numero: true,
                        descripcion: true,
                        numeroIdentificacion: true,
                        clasificacion: true,
                        zona: true
                    },
                    take: 100 // Limitar a 100 riesgos
                },
                dofaItems: true,
                normatividades: true,
                contextos: true,
                participantes: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true
                    }
                }
            }
        });
        if (!proceso) return res.status(404).json({ error: 'Proceso not found' });
        
        // OPTIMIZADO: Cachear por 5 minutos
        await redisSet(cacheKey, proceso, 300);
        
        res.json(proceso);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching proceso' });
    }
};

export const createProceso = async (req: Request, res: Response) => {
    const { nombre, descripcion, objetivo, tipo, responsableId, areaId, ...rest } = req.body;
    try {
        const data: any = {
            nombre,
            descripcion,
            objetivo,
            tipo,
            responsableId: responsableId ? Number(responsableId) : null,
            areaId: areaId ? Number(areaId) : null,
        };

        // Solo agregar campos opcionales si vienen y no son nulos
        if (req.body.vicepresidencia) data.vicepresidencia = req.body.vicepresidencia;
        if (req.body.gerencia) data.gerencia = req.body.gerencia;
        if (req.body.sigla !== undefined) data.sigla = String(req.body.sigla).toUpperCase().trim();
        if (req.body.estado) data.estado = req.body.estado;
        if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);

        const nuevoProceso = await prisma.proceso.create({
            data
        });
        
        // NUEVO: Si se asignó un responsableId, crear registro en ProcesoResponsable con modo="proceso"
        if (responsableId && Number(responsableId) > 0) {
            try {
                await prisma.procesoResponsable.upsert({
                    where: {
                        procesoId_usuarioId_modo: {
                            procesoId: nuevoProceso.id,
                            usuarioId: Number(responsableId),
                            modo: 'proceso'
                        }
                    },
                    create: {
                        procesoId: nuevoProceso.id,
                        usuarioId: Number(responsableId),
                        modo: 'proceso'
                    },
                    update: {} // No actualizar nada si ya existe
                });
            } catch (error) {
                // No fallar la creación del proceso si falla esto
            }
        }
        
        // OPTIMIZADO: Invalidar caché de procesos
        await redisSet('procesos:all', null, 0);
        
        res.json(nuevoProceso);
    } catch (error) {
        res.status(500).json({
            error: 'Error creating proceso',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { dofaItems, normatividades, contextos, participantesIds, id: bodyId, responsableId, areaId, ...rest } = req.body;
    try {
        const updateData: any = { ...rest };

        // Mapear objetivoProceso (DTO del frontend) al campo real "objetivo" del modelo Proceso
        if (updateData.objetivoProceso !== undefined) {
            updateData.objetivo = updateData.objetivoProceso;
            delete updateData.objetivoProceso;
        }

        // Asegurar que sigla se guarde en mayúsculas
        let siglaActualizada = false;
        let nuevaSigla = '';
        if (rest.sigla !== undefined) {
            nuevaSigla = String(rest.sigla).toUpperCase().trim();
            // Verificar si la sigla realmente cambió
            const procesoActual = await prisma.proceso.findUnique({
                where: { id },
                select: { sigla: true, responsableId: true }
            });
            if (procesoActual?.sigla !== nuevaSigla) {
                siglaActualizada = true;
                updateData.sigla = nuevaSigla;
            }
        }

        // Guardar el responsableId anterior para comparar
        const procesoAnterior = await prisma.proceso.findUnique({
            where: { id },
            select: { responsableId: true }
        });

        if (responsableId !== undefined) {
            updateData.responsableId = responsableId ? Number(responsableId) : null;
        }
        if (areaId) updateData.areaId = Number(areaId);

        if (dofaItems) {
            updateData.dofaItems = {
                deleteMany: {},
                create: dofaItems.map((item: any) => ({
                    tipo: item.tipo,
                    descripcion: item.descripcion
                }))
            };
        }

        if (normatividades) {
            updateData.normatividades = {
                deleteMany: {},
                create: normatividades.map((item: any) => ({
                    numero: item.numero || 0,
                    nombre: item.nombre,
                    estado: item.estado,
                    regulador: item.regulador,
                    sanciones: item.sanciones,
                    plazoImplementacion: item.plazoImplementacion,
                    cumplimiento: item.cumplimiento,
                    detalleIncumplimiento: item.detalleIncumplimiento,
                    riesgoIdentificado: item.riesgoIdentificado,
                    clasificacion: item.clasificacion,
                    comentarios: item.comentarios
                }))
            };
        }

        if (contextos) {
            updateData.contextos = {
                deleteMany: {},
                create: contextos.map((item: any) => ({
                    tipo: item.tipo,
                    descripcion: item.descripcion
                }))
            };
        }

        if (participantesIds) {
            updateData.participantes = {
                set: (participantesIds as string[]).map((id) => ({ id: Number(id) }))
            };
        }

        const proceso = await prisma.proceso.update({
            where: { id },
            data: updateData,
            include: {
                dofaItems: true,
                normatividades: true,
                contextos: true,
                participantes: true,
            }
        });

        // NUEVO: Sincronizar ProcesoResponsable cuando cambia responsableId
        if (responsableId !== undefined) {
            const nuevoResponsableId = responsableId ? Number(responsableId) : null;
            const anteriorResponsableId = procesoAnterior?.responsableId;

            // Si cambió el responsableId
            if (nuevoResponsableId !== anteriorResponsableId) {
                try {
                    // Eliminar el responsable anterior con modo="proceso" si existía
                    if (anteriorResponsableId) {
                        await prisma.procesoResponsable.deleteMany({
                            where: {
                                procesoId: id,
                                usuarioId: anteriorResponsableId,
                                modo: 'proceso'
                            }
                        });
                    }

                    // Crear el nuevo responsable con modo="proceso" si hay uno nuevo
                    if (nuevoResponsableId && nuevoResponsableId > 0) {
                        await prisma.procesoResponsable.upsert({
                            where: {
                                procesoId_usuarioId_modo: {
                                    procesoId: id,
                                    usuarioId: nuevoResponsableId,
                                    modo: 'proceso'
                                }
                            },
                            create: {
                                procesoId: id,
                                usuarioId: nuevoResponsableId,
                                modo: 'proceso'
                            },
                            update: {} // No actualizar nada si ya existe
                        });
                    }
                } catch (error) {
                    // No fallar la actualización del proceso si falla esto
                }
            }
        }

        // OPTIMIZADO: Invalidar caché de procesos
        await redisSet('procesos:all', null, 0);
        await redisSet(`proceso:${id}`, null, 0);

        // Si se actualizó la sigla, actualizar numeroIdentificacion de todos los riesgos del proceso
        if (siglaActualizada && nuevaSigla) {
            try {
                const riesgos = await prisma.riesgo.findMany({
                    where: { procesoId: id },
                    select: { id: true, numero: true }
                });

                // Actualizar numeroIdentificacion de cada riesgo: número + nueva sigla
                await Promise.all(
                    riesgos.map(riesgo => 
                        prisma.riesgo.update({
                            where: { id: riesgo.id },
                            data: {
                                numeroIdentificacion: `${riesgo.numero}${nuevaSigla}`
                            }
                        })
                    )
                );

            } catch (error) {
                // No fallar la actualización del proceso si falla la actualización de riesgos
            }
        }

        res.json(proceso);
    } catch (error) {
        res.status(500).json({ error: 'Error updating proceso' });
    }
};

export const deleteProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.proceso.delete({ where: { id } });
        await redisSet('procesos:all', null, 0);
        await redisSet(`proceso:${id}`, null, 0);
        res.json({ message: 'Proceso deleted' });
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'proceso', 'riesgos, evaluaciones, responsables o asignaciones');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};
export const bulkUpdateProcesos = async (req: Request, res: Response) => {
    const procesos = req.body;
    try {
        if (!Array.isArray(procesos)) {
            return res.status(400).json({ error: 'Expected array of procesos' });
        }

        const updated = await Promise.all(
            procesos.map(async p => {
                const updateData: any = {};
                
                // Only include fields if they're provided
                if (p.responsableId !== undefined) {
                    // Handle null, empty string, 0, or valid numbers
                    if (p.responsableId === null || p.responsableId === '' || p.responsableId === 0 || p.responsableId === '0') {
                        updateData.responsableId = null;
                    } else {
                        updateData.responsableId = Number(p.responsableId);
                    }
                }
                
                if (p.areaId !== undefined) {
                    if (p.areaId === null || p.areaId === '' || p.areaId === 0 || p.areaId === '0') {
                        updateData.areaId = null;
                    } else {
                        updateData.areaId = Number(p.areaId);
                    }
                }
                
                if (p.nombre !== undefined) updateData.nombre = p.nombre;
                if (p.descripcion !== undefined) updateData.descripcion = p.descripcion;
                if (p.objetivo !== undefined) updateData.objetivo = p.objetivo;
                if (p.tipo !== undefined) updateData.tipo = p.tipo;
                if (p.estado !== undefined) updateData.estado = p.estado;
                
                const procesoActualizado = await prisma.proceso.update({
                    where: { id: Number(p.id) },
                    data: updateData
                });

                // NUEVO: Sincronizar ProcesoResponsable si cambió responsableId
                if (p.responsableId !== undefined) {
                    try {
                        const nuevoResponsableId = updateData.responsableId;
                        
                        // Eliminar responsables anteriores con modo="proceso"
                        await prisma.procesoResponsable.deleteMany({
                            where: {
                                procesoId: Number(p.id),
                                modo: 'proceso'
                            }
                        });

                        // Crear nuevo responsable si hay uno
                        if (nuevoResponsableId && nuevoResponsableId > 0) {
                            await prisma.procesoResponsable.upsert({
                                where: {
                                    procesoId_usuarioId_modo: {
                                        procesoId: Number(p.id),
                                        usuarioId: nuevoResponsableId,
                                        modo: 'proceso'
                                    }
                                },
                                create: {
                                    procesoId: Number(p.id),
                                    usuarioId: nuevoResponsableId,
                                    modo: 'proceso'
                                },
                                update: {}
                            });
                        }
                    } catch (error) {}
                }

                return procesoActualizado;
            })
        );
        res.json(updated);
    } catch (error) {
        res.status(500).json({
            error: 'Error updating procesos',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const duplicateProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { overrides } = req.body;
    try {
        const original = await prisma.proceso.findUnique({
            where: { id },
            include: { riesgos: true }
        });
        if (!original) return res.status(404).json({ error: 'Proceso not found' });

        const { id: _, createdAt: __, updatedAt: ___, riesgos, ...data } = original;
        // Simple duplication for now, could be more complex (duplicating risks too)
        const duplicado = await prisma.proceso.create({
            data: {
                ...data as any,
                nombre: `${data.nombre} (Copia) - ${Date.now()}`,
                ...overrides
            }
        });
        res.json(duplicado);
    } catch (error) {
        res.status(500).json({ error: 'Error duplicating proceso' });
    }
};
