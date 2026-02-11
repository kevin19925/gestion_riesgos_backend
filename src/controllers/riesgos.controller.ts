import { Request, Response } from 'express';
import prisma from '../prisma';

export const getRiesgos = async (req: Request, res: Response) => {
    const { procesoId, clasificacion, busqueda, page, pageSize, zona } = req.query;
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
        console.error(error);
        res.status(500).json({ error: 'Error fetching riesgos' });
    }
};

export const getRiesgoById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
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
        res.status(500).json({ error: 'Error fetching riesgo' });
    }
};

export const createRiesgo = async (req: Request, res: Response) => {
    const { causas, priorizacion, ...riesgoData } = req.body;
    // Riesgo data contains flat fields, but might contain nested like causas if using form data structured differently
    // Based on mockData, causas array is separate sometimes?
    //createRiesgoDto usually just risk fields.

    try {
        const nuevoRiesgo = await prisma.riesgo.create({
            data: {
                ...riesgoData,
                // If causas are provided in creation
                causas: causas ? {
                    create: causas.map((causa: any) => ({
                        descripcion: causa.descripcion,
                        fuenteCausa: causa.fuenteCausa,
                        frecuencia: causa.frecuencia,
                        seleccionada: causa.seleccionada,
                        controles: causa.controles ? {
                            create: causa.controles
                        } : undefined
                    }))
                } : undefined
            },
            include: {
                evaluacion: true,
                causas: true
            }
        });
        res.json(nuevoRiesgo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error creating riesgo' });
    }
};

export const updateRiesgo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { evaluacion, causas, priorizacion, ...data } = req.body;
    try {
        // 1. Update basic fields
        const updated = await prisma.riesgo.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        });

        // 2. Handle nested updates if necessary or let separate endpoints handle them
        // Usually updateRiesgo handles basic info.
        // If causas are passed, we might need a transaction to delete/recreate or update
        // For simplicity, let's assume specific endpoints for complex nested updates, or standard update just updates properties

        // If evaluacion is passed here:
        if (evaluacion) {
            await prisma.evaluacionRiesgo.upsert({
                where: { riesgoId: id },
                create: { ...evaluacion, riesgoId: id },
                update: { ...evaluacion }
            });
        }

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating riesgo' });
    }
};

export const deleteRiesgo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.riesgo.delete({ where: { id } });
        res.json({ message: 'Riesgo deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting riesgo' });
    }
};

export const getEvaluacionByRiesgoId = async (req: Request, res: Response) => {
    const riesgoId = Number(req.params.riesgoId);
    try {
        const evaluacion = await prisma.evaluacionRiesgo.findUnique({
            where: { riesgoId }
        });
        // mock returns array? evaluate one
        res.json(evaluacion ? [evaluacion] : []);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching evaluacion' });
    }
};

export const getEstadisticas = async (req: Request, res: Response) => {
    const { procesoId } = req.query;
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
        res.status(500).json({ error: 'Error calculating stats' });
    }
};

export const getRiesgosRecientes = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 10;
    try {
        const recientes = await prisma.riesgo.findMany({
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: { evaluacion: true }
        });
        res.json(recientes);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching recent risks' });
    }
};

export const getPuntosMapa = async (req: Request, res: Response) => {
    const where: any = {};
    if (req.query.procesoId) where.procesoId = Number(req.query.procesoId);

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
                numeroIdentificacion: r.numeroIdentificacion
            }));

        res.json(puntos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching map points' });
    }
};
export const getCausas = async (req: Request, res: Response) => {
    try {
        const causas = await prisma.causaRiesgo.findMany({
            include: { controles: true }
        });
        res.json(causas);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching causas' });
    }
};
