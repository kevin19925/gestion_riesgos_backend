import { Request, Response } from 'express';
import prisma from '../prisma';

export const getProcesos = async (req: Request, res: Response) => {
    try {
        const procesos = await prisma.proceso.findMany({
            include: {
                responsable: true,
                area: {
                    include: { director: true }
                },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(procesos);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching procesos' });
    }
};

export const getProcesoById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const proceso = await prisma.proceso.findUnique({
            where: { id },
            include: {
                responsable: true,
                area: {
                    include: { director: true }
                },
                riesgos: true,
                dofaItems: true,
                normatividades: true,
                contextos: true
            }
        });
        if (!proceso) return res.status(404).json({ error: 'Proceso not found' });
        res.json(proceso);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching proceso' });
    }
};

export const createProceso = async (req: Request, res: Response) => {
    const { nombre, descripcion, objetivo, tipo, responsableId, areaId, ...rest } = req.body;
    try {
        const nuevoProceso = await prisma.proceso.create({
            data: {
                nombre,
                descripcion,
                objetivo,
                tipo,
                responsableId,
                areaId,
                ...rest
            }
        });
        res.json(nuevoProceso);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error creating proceso' });
    }
};

export const updateProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { dofaItems, normatividades, contextos, id: bodyId, ...rest } = req.body;
    try {
        const updateData: any = { ...rest };

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

        const proceso = await prisma.proceso.update({
            where: { id },
            data: updateData,
            include: {
                dofaItems: true,
                normatividades: true,
                contextos: true
            }
        });
        res.json(proceso);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating proceso' });
    }
};

export const deleteProceso = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.proceso.delete({ where: { id } });
        res.json({ message: 'Proceso deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting proceso' });
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
                ...data,
                nombre: `${data.nombre} (Copia) - ${Date.now()}`,
                ...overrides
            }
        });
        res.json(duplicado);
    } catch (error) {
        res.status(500).json({ error: 'Error duplicating proceso' });
    }
};
