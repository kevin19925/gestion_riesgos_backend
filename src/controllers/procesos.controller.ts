import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet } from '../redisClient';

export const getProcesos = async (req: Request, res: Response) => {
    console.log('[BACKEND] getProcesos');
    try {
        // OPTIMIZADO: Caché Redis para reducir queries repetidas
        const cacheKey = 'procesos:all';
        const cached = await redisGet<any>(cacheKey);
        if (cached) {
            if (process.env.NODE_ENV === 'development') {
                console.log('[BACKEND][CACHE] getProcesos HIT');
            }
            return res.json(cached);
        }

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
        console.error('[BACKEND] Error in getProcesos:', error);
        console.error('[BACKEND] Error details:', error?.message, error?.stack);
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
        console.warn('[BACKEND] getProcesoById - Invalid or missing ID:', id);
        return res.status(400).json({ error: 'Proceso ID is required and must be a valid number' });
    }
    
    const procesoId = Number(id);
    console.log(`[BACKEND] getProcesoById - id: ${id}, parsed as: ${procesoId}`);
    
    if (isNaN(procesoId) || procesoId <= 0) {
        console.warn('[BACKEND] getProcesoById - Invalid (non-numeric or <= 0) ID:', id);
        return res.status(400).json({ error: 'Invalid proceso ID - must be a positive number' });
    }
    
    try {
        // OPTIMIZADO: Caché por proceso individual
        const cacheKey = `proceso:${procesoId}`;
        const cached = await redisGet<any>(cacheKey);
        if (cached) {
            if (process.env.NODE_ENV === 'development') {
                console.log('[BACKEND][CACHE] getProcesoById HIT', cacheKey);
            }
            return res.json(cached);
        }

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
        if (!proceso) {
            console.warn('[BACKEND] getProcesoById - Proceso not found with ID:', procesoId);
            return res.status(404).json({ error: 'Proceso not found' });
        }
        
        // OPTIMIZADO: Cachear por 5 minutos
        await redisSet(cacheKey, proceso, 300);
        
        res.json(proceso);
    } catch (error) {
        console.error('[BACKEND] Error in getProcesoById:', error);
        res.status(500).json({ error: 'Error fetching proceso' });
    }
};

export const createProceso = async (req: Request, res: Response) => {
    console.log('[BACKEND] createProceso - body:', JSON.stringify(req.body, null, 2));
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
        
        // OPTIMIZADO: Invalidar caché de procesos
        await redisSet('procesos:all', null, 0);
        
        res.json(nuevoProceso);
    } catch (error) {
        console.error('[BACKEND] Error in createProceso:', error);
        res.status(500).json({
            error: 'Error creating proceso',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const updateProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] updateProceso - id: ${id}`);
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
                select: { sigla: true }
            });
            if (procesoActual?.sigla !== nuevaSigla) {
                siglaActualizada = true;
                updateData.sigla = nuevaSigla;
            }
        }

        if (responsableId) updateData.responsableId = Number(responsableId);
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

                console.log(`[BACKEND] updateProceso - Actualizados ${riesgos.length} numeroIdentificacion de riesgos con nueva sigla: ${nuevaSigla}`);
            } catch (error) {
                console.error('[BACKEND] Error actualizando numeroIdentificacion de riesgos:', error);
                // No fallar la actualización del proceso si falla la actualización de riesgos
            }
        }

        res.json(proceso);
    } catch (error) {
        console.error('[BACKEND] Error in updateProceso:', error);
        res.status(500).json({ error: 'Error updating proceso' });
    }
};

export const deleteProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] deleteProceso - id: ${id}`);
    try {
        await prisma.proceso.delete({ where: { id } });
        
        // OPTIMIZADO: Invalidar caché de procesos
        await redisSet('procesos:all', null, 0);
        await redisSet(`proceso:${id}`, null, 0);
        
        res.json({ message: 'Proceso deleted' });
    } catch (error) {
        console.error('[BACKEND] Error in deleteProceso:', error);
        res.status(500).json({ error: 'Error deleting proceso' });
    }
};
export const bulkUpdateProcesos = async (req: Request, res: Response) => {
    console.log('[BACKEND] bulkUpdateProcesos - body:', JSON.stringify(req.body, null, 2));
    const procesos = req.body;
    try {
        if (!Array.isArray(procesos)) {
            return res.status(400).json({ error: 'Expected array of procesos' });
        }

        const updated = await Promise.all(
            procesos.map(p => {
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
                
                console.log(`[BACKEND] Updating proceso ${p.id} with:`, updateData);
                
                return prisma.proceso.update({
                    where: { id: Number(p.id) },
                    data: updateData
                });
            })
        );
        res.json(updated);
    } catch (error) {
        console.error('[BACKEND] Error in bulkUpdateProcesos:', error);
        res.status(500).json({
            error: 'Error updating procesos',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const duplicateProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] duplicateProceso - id: ${id}`);
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
        console.error('[BACKEND] Error in duplicateProceso:', error);
        res.status(500).json({ error: 'Error duplicating proceso' });
    }
};
