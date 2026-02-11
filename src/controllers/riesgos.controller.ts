import { Request, Response } from 'express';
import prisma from '../prisma';

export const getRiesgos = async (req: Request, res: Response) => {
    const { procesoId, clasificacion, busqueda, page, pageSize, zona } = req.query;
    console.log('[BACKEND] getRiesgos - query:', JSON.stringify(req.query, null, 2));
    const where: any = {};
    if (procesoId) where.procesoId = Number(procesoId);
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
        const [riesgos, total] = await Promise.all([
            prisma.riesgo.findMany({
                where,
                take,
                skip,
                include: {
                    evaluacion: true,
                    proceso: true,
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
    const { causas, priorizacion, ...riesgoData } = req.body;

    try {
        const data: any = {
            ...riesgoData,
            procesoId: Number(riesgoData.procesoId)
        };

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
    } catch (error) {
        console.error('[BACKEND] Error in createRiesgo:', error);
        res.status(500).json({ error: 'Error creating riesgo' });
    }
};

export const updateRiesgo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    console.log(`[BACKEND] updateRiesgo - id: ${id}, body:`, JSON.stringify(req.body, null, 2));
    const { evaluacion, causas, priorizacion, ...data } = req.body;
    try {
        if (data.procesoId) data.procesoId = Number(data.procesoId);

        const updated = await prisma.riesgo.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        });

        if (evaluacion) {
            await prisma.evaluacionRiesgo.upsert({
                where: { riesgoId: id },
                create: { ...evaluacion, riesgoId: id },
                update: { ...evaluacion }
            });
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
            .filter(r => r.evaluacion)
            .map(r => ({
                riesgoId: r.id,
                descripcion: r.descripcion,
                probabilidad: r.evaluacion!.probabilidad,
                impacto: r.evaluacion!.impactoGlobal,

                // Residual
                probabilidadResidual: r.evaluacion!.probabilidadResidual ?? r.evaluacion!.probabilidad,
                impactoResidual: r.evaluacion!.impactoResidual ?? r.evaluacion!.impactoGlobal,

                nivelRiesgo: r.evaluacion!.nivelRiesgo,
                clasificacion: r.clasificacion,
                numero: r.numero,
                siglaGerencia: r.siglaGerencia || '',
                numeroIdentificacion: r.numeroIdentificacion || `${r.id}R`
            }));

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
