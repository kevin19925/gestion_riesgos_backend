import { Request, Response } from 'express';
import prisma from '../prisma';

export const getRiesgos = async (req: Request, res: Response) => {
    const { procesoId, clasificacion, busqueda, page, pageSize, zona, includeCausas } = req.query;
    console.log('[BACKEND] getRiesgos - query:', JSON.stringify(req.query, null, 2));
    const where: any = {};
    if (procesoId) {
        const parsedProcesoId = Number(procesoId);
        if (!isNaN(parsedProcesoId) && parsedProcesoId > 0) {
            where.procesoId = parsedProcesoId;
        }
    }
    if (clasificacion && clasificacion !== 'all') where.clasificacion = String(clasificacion);
    if (zona) where.zona = String(zona);
    if (busqueda) {
        where.OR = [
            { descripcion: { contains: String(busqueda), mode: 'insensitive' } },
            { causaRiesgo: { contains: String(busqueda), mode: 'insensitive' } },
        ];
    }

    const take = Number(pageSize) || 10;
    const skip = (Number(page) - 1) * take || 0;

    try {
        const includeCausasFlag = String(includeCausas) === 'true';
        const [riesgos, total] = await Promise.all([
            prisma.riesgo.findMany({
                where,
                take,
                skip,
                include: {
                    evaluacion: true,
                    proceso: true,
                    objetivo: true, // Incluir relación objetivo
                    causas: includeCausasFlag ? { include: { controles: true } } : false,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.riesgo.count({ where })
        ]);

        res.json({
            data: riesgos,
            total,
            page: Number(page) || 1,
            pageSize: take,
            totalPages: Math.ceil(total / take)
        });
    } catch (error) {
        console.error('[BACKEND] Error in getRiesgos:', error);
        res.status(500).json({ error: 'Error fetching riesgos' });
    }
};

export const getRiesgoById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] getRiesgoById - id: ${id}`);
    
    // Validar que el ID sea un número válido
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid riesgo ID' });
    }
    
    try {
        const riesgo = await prisma.riesgo.findUnique({
            where: { id },
            include: {
                evaluacion: true,
                causas: {
                    include: {
                        controles: true
                    }
                },
                priorizacion: {
                    include: {
                        planesAccion: true
                    }
                },
                proceso: {
                    include: { responsable: true } // to verify access if needed
                }
            }
        });

        if (!riesgo) return res.status(404).json({ error: 'Riesgo not found' });
        res.json(riesgo);
    } catch (error) {
        console.error('[BACKEND] Error in getRiesgoById:', error);
        res.status(500).json({ error: 'Error fetching riesgo' });
    }
};

export const createRiesgo = async (req: Request, res: Response) => {
    console.log('[BACKEND] createRiesgo - body:', JSON.stringify(req.body, null, 2));
    const { evaluacion, causas, priorizacion, ...riesgoData } = req.body;

    try {
        // Validate required fields
        if (!riesgoData.procesoId) {
            return res.status(400).json({ error: 'procesoId is required' });
        }
        if (!riesgoData.numero && riesgoData.numero !== 0) {
            return res.status(400).json({ error: 'numero is required' });
        }
        if (!riesgoData.descripcion) {
            return res.status(400).json({ error: 'descripcion is required' });
        }

        const data: any = {
            ...riesgoData,
            procesoId: Number(riesgoData.procesoId),
            numero: Number(riesgoData.numero)
        };

        // Create evaluation data if provided
        if (evaluacion) {
            data.evaluacion = {
                create: evaluacion
            };
        }

        if (causas) {
            data.causas = {
                create: causas.map((causa: any) => ({
                    descripcion: causa.descripcion,
                    fuenteCausa: causa.fuenteCausa,
                    frecuencia: causa.frecuencia,
                    seleccionada: causa.seleccionada,
                    controles: causa.controles ? {
                        create: causa.controles
                    } : undefined
                }))
            };
        }

        const nuevoRiesgo = await prisma.riesgo.create({
            data,
            include: {
                evaluacion: true,
                causas: true
            }
        });
        res.json(nuevoRiesgo);
    } catch (error: any) {
        console.error('[BACKEND] Error in createRiesgo:', error);
        
        // Handle unique constraint violations
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0] || 'unknown';
            return res.status(400).json({ 
                error: `Duplicate ${field}: A risk with this ${field} already exists for this process`,
                details: error.message
            });
        }
        
        // Handle foreign key constraint violations
        if (error.code === 'P2003') {
            return res.status(400).json({ 
                error: 'Invalid reference: Process or related entity does not exist',
                details: error.message
            });
        }
        
        res.status(500).json({ error: 'Error creating riesgo', details: error.message });
    }
};

export const updateRiesgo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] updateRiesgo - id: ${id}, body:`, JSON.stringify(req.body, null, 2));
    let { evaluacion, causas, priorizacion, ...data } = req.body;
    try {
        if (data.procesoId) data.procesoId = Number(data.procesoId);

        // Mover campos de evaluación residual si vienen en el body raíz
        const evaluacionFields = ['riesgoResidual', 'probabilidadResidual', 'impactoResidual', 'nivelRiesgoResidual'];
        const evaluacionUpdate: any = { ...evaluacion };
        evaluacionFields.forEach(field => {
            if (data[field] !== undefined) {
                evaluacionUpdate[field] = data[field];
                delete data[field];
            }
        });

        const updated = await prisma.riesgo.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        });

        // Solo actualizar evaluación si ya existe (no crear nueva)
        if (Object.keys(evaluacionUpdate).length > 0) {
            const existingEval = await prisma.evaluacionRiesgo.findUnique({
                where: { riesgoId: id }
            });
            if (existingEval) {
                await prisma.evaluacionRiesgo.update({
                    where: { riesgoId: id },
                    data: { ...evaluacionUpdate }
                });
            }
        }

        res.json(updated);
    } catch (error) {
        console.error('[BACKEND] Error in updateRiesgo:', error);
        res.status(500).json({ error: 'Error updating riesgo' });
    }
};

export const deleteRiesgo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] deleteRiesgo - id: ${id}`);
    try {
        await prisma.riesgo.delete({ where: { id } });
        res.json({ message: 'Riesgo deleted' });
    } catch (error) {
        console.error('[BACKEND] Error in deleteRiesgo:', error);
        res.status(500).json({ error: 'Error deleting riesgo' });
    }
};

export const getEvaluacionByRiesgoId = async (req: Request, res: Response) => {
    const riesgoId = Number(req.params.riesgoId);
    console.log(`[BACKEND] getEvaluacionByRiesgoId - riesgoId: ${riesgoId}`);
    try {
        const evaluacion = await prisma.evaluacionRiesgo.findUnique({
            where: { riesgoId }
        });
        // mock returns array? evaluate one
        res.json(evaluacion ? [evaluacion] : []);
    } catch (error) {
        console.error('[BACKEND] Error in getEvaluacionByRiesgoId:', error);
        res.status(500).json({ error: 'Error fetching evaluacion' });
    }
};

export const getEstadisticas = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    console.log(`[BACKEND] getEstadisticas - procesoId: ${procesoId}`);
    try {
        const where: any = {};
        if (procesoId) where.procesoId = Number(procesoId);

        const totalRiesgos = await prisma.riesgo.count({ where });

        const riesgos = await prisma.riesgo.findMany({
            where,
            include: { evaluacion: true }
        });

        const stats = {
            totalRiesgos,
            criticos: riesgos.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Crítico').length,
            altos: riesgos.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Alto').length,
            medios: riesgos.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Medio').length,
            bajos: riesgos.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Bajo').length,
            positivos: riesgos.filter((r: any) => r.clasificacion === 'Positiva').length,
            negativos: riesgos.filter((r: any) => r.clasificacion === 'Negativa').length,
            evaluados: riesgos.filter((r: any) => r.evaluacion).length,
            sinEvaluar: riesgos.filter((r: any) => !r.evaluacion).length,
        };

        res.json(stats);
    } catch (error) {
        console.error('[BACKEND] Error in getEstadisticas:', error);
        res.status(500).json({ error: 'Error calculating stats' });
    }
};

export const getRiesgosRecientes = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 10;
    console.log(`[BACKEND] getRiesgosRecientes - limit: ${limit}`);
    try {
        const recientes = await prisma.riesgo.findMany({
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: { evaluacion: true }
        });
        res.json(recientes);
    } catch (error) {
        console.error('[BACKEND] Error in getRiesgosRecientes:', error);
        res.status(500).json({ error: 'Error fetching recent risks' });
    }
};

export const getPuntosMapa = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
    console.log(`[BACKEND] getPuntosMapa - procesoId: ${procesoId}`);
    const where: any = {};
    if (procesoId) where.procesoId = Number(procesoId);

    try {
        const riesgos = await prisma.riesgo.findMany({
            where,
            include: { evaluacion: true, proceso: true }
        });

        const puntos = riesgos
            .filter(r => {
                // Solo incluir riesgos con evaluación válida
                if (!r.evaluacion) return false;
                const prob = Number(r.evaluacion.probabilidad);
                const imp = Number(r.evaluacion.impactoGlobal);
                // Validar que sean números válidos entre 1 y 5
                return !isNaN(prob) && !isNaN(imp) && prob >= 1 && prob <= 5 && imp >= 1 && imp <= 5;
            })
            .map(r => {
                // Asegurar que probabilidad e impacto sean números enteros en rango 1-5
                const probabilidad = Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.probabilidad))));
                const impacto = Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.impactoGlobal))));
                
                const probabilidadResidual = r.evaluacion!.probabilidadResidual 
                    ? Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.probabilidadResidual))))
                    : probabilidad;
                const impactoResidual = r.evaluacion!.impactoResidual
                    ? Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.impactoResidual))))
                    : impacto;
                
                return {
                    riesgoId: r.id,
                    descripcion: r.descripcion,
                    probabilidad,
                    impacto,

                    // Residual
                    probabilidadResidual,
                    impactoResidual,

                    nivelRiesgo: r.evaluacion!.nivelRiesgo,
                    clasificacion: r.clasificacion,
                    numero: r.numero,
                    siglaGerencia: r.siglaGerencia || '',
                    numeroIdentificacion: r.numeroIdentificacion || `${r.id}R`,
                    procesoId: r.procesoId,
                    procesoNombre: r.proceso?.nombre || 'Proceso desconocido'
                };
            });
        
        console.log(`[BACKEND] getPuntosMapa - ${puntos.length} puntos válidos generados de ${riesgos.length} riesgos totales`);

        res.json(puntos);
    } catch (error) {
        console.error('[BACKEND] Error in getPuntosMapa:', error);
        res.status(500).json({ error: 'Error fetching map points' });
    }
};
export const getCausas = async (req: Request, res: Response) => {
    console.log('[BACKEND] getCausas');
    try {
        const causas = await prisma.causaRiesgo.findMany({
            include: { controles: true }
        });
        res.json(causas);
    } catch (error) {
        console.error('[BACKEND] Error in getCausas:', error);
        res.status(500).json({ error: 'Error fetching causas' });
    }
};

export const createCausa = async (req: Request, res: Response) => {
    console.log('[BACKEND] createCausa', req.body);
    try {
        const { riesgoId, descripcion, fuenteCausa, frecuencia, seleccionada, tipoGestion, gestion } = req.body;
        
        if (!riesgoId || !descripcion) {
            return res.status(400).json({ error: 'riesgoId y descripcion son requeridos' });
        }

        const causa = await prisma.causaRiesgo.create({
            data: {
                riesgoId: Number(riesgoId),
                descripcion,
                fuenteCausa: fuenteCausa || null,
                frecuencia: frecuencia ? String(frecuencia) : null,
                seleccionada: seleccionada !== undefined ? seleccionada : true,
                tipoGestion: tipoGestion || null,
                gestion: gestion || null
            }
        });
        
        console.log('[BACKEND] Causa creada:', causa.id);
        res.status(201).json(causa);
    } catch (error) {
        console.error('[BACKEND] Error in createCausa:', error);
        res.status(500).json({ error: 'Error creating causa' });
    }
};

export const updateCausa = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log('[BACKEND] updateCausa - id:', id, 'body:', req.body);
    try {
        const { tipoGestion, gestion, descripcion, fuenteCausa, frecuencia } = req.body;
        const updateData: any = {};
        
        // Campos de gestión (existentes)
        if (tipoGestion !== undefined) updateData.tipoGestion = tipoGestion;
        if (gestion !== undefined) updateData.gestion = gestion;
        
        // Campos básicos de causa (nuevos)
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (fuenteCausa !== undefined) updateData.fuenteCausa = fuenteCausa;
        if (frecuencia !== undefined) updateData.frecuencia = frecuencia ? String(frecuencia) : null;
        
        const updated = await prisma.causaRiesgo.update({
            where: { id },
            data: updateData
        });
        console.log('[BACKEND] Causa actualizada:', updated.id);
        res.json(updated);
    } catch (error) {
        console.error('[BACKEND] Error in updateCausa:', error);
        res.status(500).json({ error: 'Error updating causa' });
    }
};

export const deleteCausa = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log('[BACKEND] deleteCausa - id:', id, 'params:', req.params);
    try {
        // Verificar que la causa existe antes de intentar eliminarla
        const causa = await prisma.causaRiesgo.findUnique({
            where: { id }
        });
        
        if (!causa) {
            console.log('[BACKEND] Causa no encontrada:', id);
            return res.status(404).json({ error: `Causa con id ${id} no encontrada` });
        }
        
        await prisma.causaRiesgo.delete({
            where: { id }
        });
        console.log('[BACKEND] Causa eliminada exitosamente:', id);
        res.json({ message: 'Causa eliminada correctamente', id });
    } catch (error: any) {
        console.error('[BACKEND] Error in deleteCausa:', error);
        // Si es un error de Prisma (causa no encontrada)
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Causa con id ${id} no encontrada` });
        }
        res.status(500).json({ error: 'Error deleting causa', details: error.message });
    }
};
