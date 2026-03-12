import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet, redisDel } from '../redisClient';
import { recalcularResidualPorRiesgo } from '../services/recalculoResidual.service';

/** Invalida caché de listado de riesgos del proceso para que el frontend vea datos actualizados */
async function invalidarCacheRiesgosProceso(procesoId: number): Promise<void> {
    if (!procesoId) return;
    const base = `riesgos:proceso:${procesoId}:page:1:size:50:causas:`;
    await Promise.all([redisDel(`${base}false`), redisDel(`${base}true`)]).catch(() => {});
}

export const getRiesgos = async (req: Request, res: Response) => {
    const { procesoId, clasificacion, busqueda, page, pageSize, includeCausas } = req.query;
    const where: any = {};
    if (procesoId) {
        const parsedProcesoId = Number(procesoId);
        if (!isNaN(parsedProcesoId) && parsedProcesoId > 0) {
            where.procesoId = parsedProcesoId;
        }
    }
    // OPTIMIZADO: Filtro de clasificación - usar evaluacion.nivelRiesgo de forma segura
    if (clasificacion && clasificacion !== 'all') {
        where.evaluacion = {
            nivelRiesgo: String(clasificacion)
        };
    }
    if (busqueda) {
        where.OR = [
            { descripcion: { contains: String(busqueda), mode: 'insensitive' } },
            { numeroIdentificacion: { contains: String(busqueda), mode: 'insensitive' } },
        ];
    }

    // OPTIMIZADO: Paginación robusta — normalizar para evitar NaN o valores inválidos
    const pageNumRaw = Number(page);
    const pageNum = (Number.isFinite(pageNumRaw) && pageNumRaw >= 1) ? pageNumRaw : 1;
    const pageSizeRaw = Number(pageSize);
    const requestedPageSize = (Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1) ? pageSizeRaw : 50;
    const take = Math.min(Math.max(1, requestedPageSize), 100); // Entre 1 y 100
    const skip = Math.max(0, (pageNum - 1) * take);

    try {
        // Caché en Redis para listados pesados (por proceso/página)
        const includeCausasFlag = String(includeCausas) === 'true';
        const cacheKey =
            procesoId
                ? `riesgos:proceso:${procesoId}:page:${pageNum}:size:${take}:causas:${includeCausasFlag}`
                : null;

        if (cacheKey) {
            const cached = await redisGet<any>(cacheKey);
            if (cached) return res.json(cached);
        }

        // OPTIMIZADO: Include simple - Prisma permite select en el nivel superior
        // Usar select en el nivel superior para evaluacion y proceso
        const include: any = {
            evaluacion: true,
            proceso: {
                select: {
                    id: true,
                    nombre: true,
                    sigla: true,
                }
            },
            tipologiaTipo1Relacion: { select: { id: true, nombre: true } },
            tipologiaTipo2Relacion: { select: { id: true, nombre: true } }
        };
        
        // Incluir causas solo si se solicita
        // OPTIMIZADO: Reducir a 10 causas por riesgo para mejor rendimiento
        if (includeCausasFlag) {
            include.causas = {
                take: 10, // Limitar causas a 10 por riesgo para máximo rendimiento
                orderBy: { id: 'asc' } // Ordenar para consistencia
                // Nota: No usar select dentro de include en Prisma
            };
        }
        
        // OPTIMIZADO: Ejecutar queries en paralelo para mejor rendimiento
        // Usar índices en procesoId y createdAt para queries más rápidas
        // OPTIMIZADO: Ordenamiento simple por createdAt (más rápido y confiable)
        const orderBy = { createdAt: 'desc' as const };

        const [riesgos, total] = await Promise.all([
            prisma.riesgo.findMany({
                where,
                take,
                skip,
                include,
                orderBy, // Ordenamiento simple para mejor rendimiento
            }),
            // OPTIMIZADO: Count más rápido usando índice
            prisma.riesgo.count({ where })
        ]);

        const totalPages = total > 0 ? Math.ceil(total / take) : 0;
        const data = riesgos.map((r: any) => ({
            ...r,
            tipoRiesgo: r.tipologiaTipo1Relacion?.nombre ?? null,
            subtipoRiesgo: r.tipologiaTipo2Relacion?.nombre ?? null,
            tipoRiesgoId: r.tipologiaTipo1Id ?? null,
            subtipoRiesgoId: r.tipologiaTipo2Id ?? null
        }));

        const payload = {
            data,
            total,
            page: pageNum,
            pageSize: take,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPreviousPage: pageNum > 1
        };

        if (cacheKey) {
            // TTL corto (60s) para evitar datos viejos y no depender de invalidación compleja
            await redisSet(cacheKey, payload, 60);
        }

        res.json(payload);
    } catch (error: any) {
        res.status(500).json({ 
            error: 'Error fetching riesgos',
            message: error?.message || 'Unknown error',
            code: error?.code
        });
    }
};

export const getRiesgoById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    // Validar que el ID sea un número válido
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid riesgo ID' });
    }
    
    try {
        // OPTIMIZADO: Caché por riesgo individual
        const cacheKey = `riesgo:${id}`;
        const cached = await redisGet<any>(cacheKey);
        if (cached) return res.json(cached);

        const riesgo = await prisma.riesgo.findUnique({
            where: { id },
            select: {
                id: true,
                procesoId: true,
                numero: true,
                descripcion: true,
                clasificacion: true,
                numeroIdentificacion: true,
                tipologiaTipo1Id: true,
                tipologiaTipo2Id: true,
                objetivoId: true,
                tipologiaTipo3: true,
                tipologiaTipo4: true,
                origen: true,
                vicepresidenciaGerenciaAlta: true,
                gerencia: true,
                createdAt: true,
                updatedAt: true,
                evaluacion: true,
                tipologiaTipo1Relacion: { select: { id: true, nombre: true } },
                tipologiaTipo2Relacion: { select: { id: true, nombre: true } },
                causas: {
                    take: 20,
                    orderBy: { id: 'desc' },
                    select: {
                        id: true,
                        riesgoId: true,
                        descripcion: true,
                        fuenteCausa: true,
                        frecuencia: true,
                        seleccionada: true,
                        tipoGestion: true,
                        gestion: true
                    }
                },
                priorizacion: {
                    select: {
                        id: true,
                        riesgoId: true,
                        calificacionFinal: true,
                        respuesta: true,
                        responsable: true,
                        puntajePriorizacion: true,
                        fechaAsignacion: true,
                        planesAccion: {
                            take: 10,
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                },
                proceso: {
                    select: {
                        id: true,
                        nombre: true,
                        sigla: true,
                        descripcion: true,
                        tipo: true
                    }
                }
            }
        });

        if (!riesgo) return res.status(404).json({ error: 'Riesgo not found' });
        const out = {
            ...riesgo,
            tipoRiesgo: (riesgo as any).tipologiaTipo1Relacion?.nombre ?? null,
            subtipoRiesgo: (riesgo as any).tipologiaTipo2Relacion?.nombre ?? null,
            tipoRiesgoId: (riesgo as any).tipologiaTipo1Id ?? null,
            subtipoRiesgoId: (riesgo as any).tipologiaTipo2Id ?? null
        };
        await redisSet(cacheKey, out, 120);
        res.json(out);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching riesgo' });
    }
};

/** GET /riesgos/next-numero?procesoId=X — devuelve el siguiente número disponible para un proceso (evita duplicados por @@unique(procesoId, numero)). */
export const getNextNumero = async (req: Request, res: Response) => {
    const procesoId = Number(req.query.procesoId);
    if (!procesoId || isNaN(procesoId)) {
        return res.status(400).json({ error: 'procesoId is required' });
    }
    try {
        const agg = await prisma.riesgo.aggregate({
            where: { procesoId },
            _max: { numero: true },
        });
        const nextNumero = (agg._max?.numero ?? 0) + 1;
        return res.json({ nextNumero });
    } catch (e: any) {
        res.status(500).json({ error: 'Error getting next numero', details: e?.message });
    }
};

export const createRiesgo = async (req: Request, res: Response) => {
    const { evaluacion, causas, priorizacion, ...riesgoData } = req.body;

    try {
        // Validate required fields
        if (!riesgoData.procesoId) {
            return res.status(400).json({ error: 'procesoId is required' });
        }
        if (!riesgoData.descripcion) {
            return res.status(400).json({ error: 'descripcion is required' });
        }

        const procesoId = Number(riesgoData.procesoId);
        // Consulta rápida: max(numero) por procesoId + sigla del proceso (en paralelo)
        const [proceso, agg] = await Promise.all([
            prisma.proceso.findUnique({ where: { id: procesoId }, select: { sigla: true } }),
            prisma.riesgo.aggregate({ where: { procesoId }, _max: { numero: true } }),
        ]);
        const sigla = (proceso?.sigla || '').trim().toUpperCase() || 'P';
        const nextNumero = (agg._max?.numero ?? 0) + 1;
        const numeroIdentificacion = `${nextNumero}${sigla}`;

        const data: any = {
            procesoId,
            numero: nextNumero,
            descripcion: String(riesgoData.descripcion ?? ''),
            clasificacion: riesgoData.clasificacion ?? null,
            numeroIdentificacion,
            tipologiaTipo1Id: riesgoData.tipoRiesgoId != null ? Number(riesgoData.tipoRiesgoId) : null,
            tipologiaTipo2Id: riesgoData.subtipoRiesgoId != null ? Number(riesgoData.subtipoRiesgoId) : null,
            objetivoId: riesgoData.objetivoId != null ? Number(riesgoData.objetivoId) : null,
            tipologiaTipo3: riesgoData.tipologiaTipo3 != null && riesgoData.tipologiaTipo3 !== '' ? String(riesgoData.tipologiaTipo3) : null,
            tipologiaTipo4: riesgoData.tipologiaTipo4 != null && riesgoData.tipologiaTipo4 !== '' ? String(riesgoData.tipologiaTipo4) : null,
            origen: riesgoData.origen ?? null,
            vicepresidenciaGerenciaAlta: riesgoData.vicepresidenciaGerenciaAlta ?? null,
            gerencia: riesgoData.gerencia ?? null
        };
        if (evaluacion && typeof evaluacion === 'object') {
            const e = evaluacion as Record<string, unknown>;
            data.evaluacion = {
                create: {
                    impactoPersonas: Number(e.impactoPersonas) || 1,
                    impactoLegal: Number(e.impactoLegal) || 1,
                    impactoAmbiental: Number(e.impactoAmbiental) || 1,
                    impactoProcesos: Number(e.impactoProcesos) || 1,
                    impactoReputacion: Number(e.impactoReputacion) || 1,
                    impactoEconomico: Number(e.impactoEconomico) || 1,
                    impactoTecnologico: Number(e.impactoTecnologico) || 1,
                    probabilidad: Number(e.probabilidad) || 1,
                    impactoGlobal: Math.round(Number(e.impactoGlobal) || 0),
                    impactoMaximo: Number(e.impactoMaximo) || 1,
                    riesgoInherente: Math.round(Number(e.riesgoInherente) || 0),
                    nivelRiesgo: String(e.nivelRiesgo ?? 'Sin Calificar')
                }
            };
        }
        if (causas) {
            data.causas = {
                create: causas.map((causa: any) => ({
                    descripcion: causa.descripcion,
                    fuenteCausa: causa.fuenteCausa,
                    frecuencia: causa.frecuencia,
                    seleccionada: causa.seleccionada,
                    controles: causa.controles ? { create: causa.controles } : undefined
                }))
            };
        }

        let nuevoRiesgo: any;
        try {
            nuevoRiesgo = await prisma.riesgo.create({
                data,
                include: { evaluacion: true, causas: true },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') {
                const agg2 = await prisma.riesgo.aggregate({ where: { procesoId }, _max: { numero: true } });
                const nextNumero2 = (agg2._max?.numero ?? 0) + 1;
                data.numero = nextNumero2;
                data.numeroIdentificacion = `${nextNumero2}${sigla}`;
                nuevoRiesgo = await prisma.riesgo.create({
                    data,
                    include: { evaluacion: true, causas: true },
                });
            } else {
                throw e;
            }
        }

        invalidarCacheRiesgosProceso(riesgoData.procesoId).catch(() => {});
        res.json(nuevoRiesgo);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(500).json({
                error: 'No se pudo crear el riesgo por número duplicado. Espere un momento e intente de nuevo.',
                details: error.message
            });
        }
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
    let { evaluacion, causas, priorizacion, ...body } = req.body;
    try {
        const data: any = {};
        if (body.procesoId !== undefined) data.procesoId = Number(body.procesoId);
        if (body.numero !== undefined) data.numero = Number(body.numero);
        if (body.descripcion !== undefined) data.descripcion = body.descripcion;
        if (body.clasificacion !== undefined) data.clasificacion = body.clasificacion;
        if (body.numeroIdentificacion !== undefined) data.numeroIdentificacion = body.numeroIdentificacion;
        if (body.tipoRiesgoId !== undefined || body.tipologiaTipo1Id !== undefined) data.tipologiaTipo1Id = (body.tipologiaTipo1Id ?? body.tipoRiesgoId) != null ? Number(body.tipologiaTipo1Id ?? body.tipoRiesgoId) : null;
        if (body.subtipoRiesgoId !== undefined || body.tipologiaTipo2Id !== undefined) data.tipologiaTipo2Id = (body.tipologiaTipo2Id ?? body.subtipoRiesgoId) != null ? Number(body.tipologiaTipo2Id ?? body.subtipoRiesgoId) : null;
        if (body.objetivoId !== undefined) data.objetivoId = body.objetivoId != null ? Number(body.objetivoId) : null;
        if (body.tipologiaTipo3 !== undefined) data.tipologiaTipo3 = body.tipologiaTipo3 == null || body.tipologiaTipo3 === '' ? null : String(body.tipologiaTipo3);
        if (body.tipologiaTipo4 !== undefined) data.tipologiaTipo4 = body.tipologiaTipo4 == null || body.tipologiaTipo4 === '' ? null : String(body.tipologiaTipo4);
        if (body.origen !== undefined) data.origen = body.origen;
        if (body.vicepresidenciaGerenciaAlta !== undefined) data.vicepresidenciaGerenciaAlta = body.vicepresidenciaGerenciaAlta;
        if (body.gerencia !== undefined) data.gerencia = body.gerencia;

        const evaluacionFields = ['riesgoResidual', 'probabilidadResidual', 'impactoResidual', 'nivelRiesgoResidual'];
        const evaluacionUpdate: any = { ...evaluacion };
        evaluacionFields.forEach(field => {
            if (body[field] !== undefined) {
                evaluacionUpdate[field] = body[field];
            }
            if (evaluacion && evaluacion[field] !== undefined) {
                evaluacionUpdate[field] = evaluacion[field];
            }
        });

        const updated = await prisma.riesgo.update({
            where: { id },
            data: { ...data, updatedAt: new Date() }
        });

        // Actualizar evaluación si se proporciona (crear si no existe)
        if (Object.keys(evaluacionUpdate).length > 0) {
            const existingEval = await prisma.evaluacionRiesgo.findUnique({
                where: { riesgoId: id }
            });
            if (existingEval) {
                // Actualizar evaluación existente
                // NOTA: No establecer updatedAt manualmente, Prisma lo maneja automáticamente con @updatedAt
                await prisma.evaluacionRiesgo.update({
                    where: { riesgoId: id },
                    data: { 
                        ...evaluacionUpdate
                    }
                });
            } else {
                // Crear nueva evaluación si no existe
                await prisma.evaluacionRiesgo.create({
                    data: {
                        riesgoId: id,
                        ...evaluacionUpdate
                    }
                });
            }
        }

        // Si se actualizaron los impactos, recalcular automáticamente riesgoInherente desde causas
        const camposImpacto = ['impactoPersonas', 'impactoLegal', 'impactoAmbiental', 'impactoProcesos', 
                               'impactoReputacion', 'impactoEconomico', 'confidencialidadSGSI', 
                               'disponibilidadSGSI', 'integridadSGSI'];
        const seActualizaronImpactos = evaluacionUpdate && camposImpacto.some(campo => evaluacionUpdate[campo] !== undefined);
        
        if (seActualizaronImpactos) {
            await recalcularRiesgoInherenteDesdeCausas(id);
        }

        await redisDel(`riesgo:${id}`);
        if (updated.procesoId) {
            await invalidarCacheRiesgosProceso(updated.procesoId);
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Error updating riesgo' });
    }
};

export const deleteRiesgo = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        // Obtener procesoId antes de eliminar para invalidar caché
        const riesgo = await prisma.riesgo.findUnique({
            where: { id },
            select: { procesoId: true }
        });
        
        await prisma.riesgo.delete({ where: { id } });
        await redisDel(`riesgo:${id}`);
        if (riesgo?.procesoId) {
            await invalidarCacheRiesgosProceso(riesgo.procesoId);
        }
        
        res.json({ message: 'Riesgo deleted' });
    } catch (error) {
        const e = error as any;
        if (e?.code === 'P2025') return res.status(404).json({ error: 'No se encontró el riesgo o ya fue eliminado.' });
        if (e?.code === 'P2003') return res.status(400).json({ error: 'No se puede eliminar el riesgo porque tiene causas, controles o evaluaciones asociados.' });
        res.status(500).json({ error: 'Error al eliminar el riesgo' });
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
        // OPTIMIZADO: Caché por proceso
        const cacheKey = procesoId ? `estadisticas:proceso:${procesoId}` : 'estadisticas:all';
        const cached = await redisGet<any>(cacheKey);
        if (cached) return res.json(cached);

        const where: any = {};
        if (procesoId) where.procesoId = Number(procesoId);

        // OPTIMIZADO: Usar queries agregadas en paralelo
        const [totalRiesgos, riesgosConEvaluacion] = await Promise.all([
            prisma.riesgo.count({ where }),
            prisma.riesgo.findMany({
                where,
                select: {
                    clasificacion: true,
                    evaluacion: {
                        select: {
                            nivelRiesgo: true
                        }
                    }
                }
            })
        ]);

        const stats = {
            totalRiesgos,
            criticos: riesgosConEvaluacion.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Crítico').length,
            altos: riesgosConEvaluacion.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Alto').length,
            medios: riesgosConEvaluacion.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Medio').length,
            bajos: riesgosConEvaluacion.filter((r: any) => r.evaluacion?.nivelRiesgo === 'Bajo').length,
            positivos: riesgosConEvaluacion.filter((r: any) => r.clasificacion === 'Positiva').length,
            negativos: riesgosConEvaluacion.filter((r: any) => r.clasificacion === 'Negativa').length,
            evaluados: riesgosConEvaluacion.filter((r: any) => r.evaluacion).length,
            sinEvaluar: riesgosConEvaluacion.filter((r: any) => !r.evaluacion).length,
        };

        // OPTIMIZADO: Cachear por 2 minutos
        await redisSet(cacheKey, stats, 120);

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
    const { procesoId } = req.query;
    const where: any = {};
    // Solo filtrar por proceso si se especifica explícitamente
    if (procesoId && procesoId !== 'all' && procesoId !== 'undefined' && procesoId !== 'null') {
        where.procesoId = Number(procesoId);
    }
    // Si no hay procesoId o es 'all', where estará vacío y se obtendrán TODOS los riesgos

    try {
        // Límite cuando no hay filtro por proceso para no devolver miles de registros
        const takeMapa = Object.keys(where).length > 0 ? undefined : 500;
        const riesgos = await prisma.riesgo.findMany({
            where,
            ...(takeMapa ? { take: takeMapa } : {}),
            include: {
                evaluacion: true,
                proceso: { select: { id: true, nombre: true, sigla: true } }
            }
        });

        // Riesgos que tienen al menos una causa con control (CONTROL o AMBOS): residual se calcula; el resto residual = inherente
        const riesgoIdsConControl = new Set<number>();
        try {
            const causasConControl = await prisma.causaRiesgo.findMany({
                where: {
                    tipoGestion: { in: ['CONTROL', 'AMBOS'] },
                    gestion: { not: null },
                    riesgoId: { in: riesgos.map(r => r.id) }
                },
                select: { riesgoId: true }
            });
            causasConControl.forEach(c => riesgoIdsConControl.add(c.riesgoId));
        } catch (_) {
            // Si falla la consulta, todos se tratan como sin control (residual = inherente)
        }

        // Incluir TODOS los riesgos con evaluación (no filtrar por valores específicos)
        // IMPORTANTE: Solo generar UN punto por riesgo (evitar duplicados)
        const riesgosProcesados = new Set<number>();
        const puntos = riesgos
            .filter(r => {
                // Solo incluir riesgos con evaluación
                if (!r.evaluacion) return false;
                // Evitar duplicados: si este riesgo ya fue procesado, saltarlo
                if (riesgosProcesados.has(r.id)) return false;
                // Incluir todos los riesgos con evaluación, incluso si no tienen valores perfectos
                // El cálculo se hará después con fallbacks
                riesgosProcesados.add(r.id);
                return true;
            })
            .map(r => {
                let probabilidad: number;
                let impacto: number;

                const riesgoInherente = r.evaluacion!.riesgoInherente;
                const probGuardada = Number(r.evaluacion!.probabilidad);
                const impGuardado = Number(r.evaluacion!.impactoGlobal);
                const tieneEjesGuardados = !isNaN(probGuardada) && probGuardada >= 1 && probGuardada <= 5 &&
                    !isNaN(impGuardado) && impGuardado >= 1 && impGuardado <= 5;

                // Prioridad 1: Usar probabilidad e impacto guardados cuando son válidos (1-5).
                // Ejes del mapa: X = Frecuencia (probabilidad), Y = Impacto. Misma convención en inherente y residual.
                if (riesgoInherente && riesgoInherente > 0 && !isNaN(riesgoInherente) && tieneEjesGuardados) {
                    probabilidad = Math.round(probGuardada);
                    impacto = Math.round(impGuardado);
                } else if (riesgoInherente && riesgoInherente > 0 && !isNaN(riesgoInherente)) {
                    // Fallback: descomponer riesgoInherente en prob×imp (puede intercambiar ejes)
                    let mejorProb = 1;
                    let mejorImp = 1;
                    let encontradoExacto = false;
                    for (let prob = 5; prob >= 1; prob--) {
                        const imp = prob;
                        const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                        if (Math.abs(valor - riesgoInherente) < 0.01) {
                            mejorProb = prob;
                            mejorImp = imp;
                            encontradoExacto = true;
                            break;
                        }
                    }
                    if (!encontradoExacto) {
                        for (let imp = 5; imp >= 1; imp--) {
                            for (let prob = 1; prob <= 5; prob++) {
                                const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                if (Math.abs(valor - riesgoInherente) < 0.01) {
                                    mejorProb = prob;
                                    mejorImp = imp;
                                    encontradoExacto = true;
                                    break;
                                }
                            }
                            if (encontradoExacto) break;
                        }
                    }
                    if (!encontradoExacto) {
                        let menorDiferencia = Infinity;
                        for (let prob = 1; prob <= 5; prob++) {
                            for (let imp = 1; imp <= 5; imp++) {
                                const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                if (valor >= riesgoInherente) {
                                    const diferencia = valor - riesgoInherente;
                                    if (diferencia < menorDiferencia) {
                                        menorDiferencia = diferencia;
                                        mejorProb = prob;
                                        mejorImp = imp;
                                    }
                                }
                            }
                        }
                        if (menorDiferencia === Infinity) {
                            for (let prob = 1; prob <= 5; prob++) {
                                for (let imp = 1; imp <= 5; imp++) {
                                    const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                    const diferencia = Math.abs(riesgoInherente - valor);
                                    if (diferencia < menorDiferencia) {
                                        menorDiferencia = diferencia;
                                        mejorProb = prob;
                                        mejorImp = imp;
                                    }
                                }
                            }
                        }
                    }
                    probabilidad = mejorProb;
                    impacto = mejorImp;
                } else {
                    // Fallback: usar probabilidad e impactoGlobal directamente, o valores por defecto
                    const probEval = Number(r.evaluacion!.probabilidad);
                    const impEval = Number(r.evaluacion!.impactoGlobal);
                    
                    if (!isNaN(probEval) && probEval >= 1 && probEval <= 5) {
                        probabilidad = Math.round(probEval);
                    } else {
                        probabilidad = 1; // Valor por defecto para que aparezca en el mapa
                    }
                    
                    if (!isNaN(impEval) && impEval >= 1 && impEval <= 5) {
                        impacto = Math.round(impEval);
                    } else {
                        impacto = 1; // Valor por defecto para que aparezca en el mapa
                    }
                }
                
                // Calcular valores residuales. Ejes: X = Frecuencia (probabilidad), Y = Impacto.
                // Si el riesgo NO tiene ninguna causa con control (solo PLAN no cuenta), residual = inherente → misma ubicación.
                const sinControles = !riesgoIdsConControl.has(r.id);

                let probabilidadResidual: number | null = null;
                let impactoResidual: number | null = null;

                if (sinControles) {
                    probabilidadResidual = probabilidad;
                    impactoResidual = impacto;
                } else {
                    // Prioridad 1: Usar BY y BZ guardados (frecuencia residual = X, impacto residual = Y).
                    // Así la ubicación en el mapa coincide con la tabla: X = frecuencia residual, Y = impacto residual.
                    const probResEval = r.evaluacion!.probabilidadResidual;
                    const impResEval = r.evaluacion!.impactoResidual;
                    if (probResEval != null && impResEval != null && !isNaN(Number(probResEval)) && !isNaN(Number(impResEval))) {
                        probabilidadResidual = Math.max(1, Math.min(5, Math.round(Number(probResEval))));
                        impactoResidual = Math.max(1, Math.min(5, Math.round(Number(impResEval))));
                    } else {
                        // Fallback: descomponer riesgoResidual en (prob, imp) solo si no hay ejes guardados
                        const riesgoResidualVal = r.evaluacion!.riesgoResidual;
                        if (riesgoResidualVal && riesgoResidualVal > 0 && !isNaN(riesgoResidualVal)) {
                            let mejorProbRes = 1;
                            let mejorImpRes = 1;
                            let encontradoExacto = false;
                            for (let prob = 1; prob <= 5; prob++) {
                                for (let imp = 1; imp <= 5; imp++) {
                                    const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                    if (Math.abs(valor - riesgoResidualVal) < 0.01) {
                                        mejorProbRes = prob;
                                        mejorImpRes = imp;
                                        encontradoExacto = true;
                                        break;
                                    }
                                }
                                if (encontradoExacto) break;
                            }
                            if (!encontradoExacto) {
                                let menorDiferencia = Infinity;
                                for (let prob = 1; prob <= 5; prob++) {
                                    for (let imp = 1; imp <= 5; imp++) {
                                        const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                        if (valor >= riesgoResidualVal) {
                                            const diferencia = valor - riesgoResidualVal;
                                            if (diferencia < menorDiferencia) {
                                                menorDiferencia = diferencia;
                                                mejorProbRes = prob;
                                                mejorImpRes = imp;
                                            }
                                        }
                                    }
                                }
                                if (menorDiferencia === Infinity) {
                                    for (let prob = 1; prob <= 5; prob++) {
                                        for (let imp = 1; imp <= 5; imp++) {
                                            const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                            const diferencia = Math.abs(riesgoResidualVal - valor);
                                            if (diferencia < menorDiferencia) {
                                                menorDiferencia = diferencia;
                                                mejorProbRes = prob;
                                                mejorImpRes = imp;
                                            }
                                        }
                                    }
                                }
                            }
                            probabilidadResidual = mejorProbRes;
                            impactoResidual = mejorImpRes;
                        } else {
                            probabilidadResidual = null;
                            impactoResidual = null;
                        }
                    }
                    if (!probabilidadResidual || !impactoResidual) {
                        probabilidadResidual = probabilidad;
                        impactoResidual = impacto;
                    }
                }
                
                // Calificación residual del riesgo (máx. de causas con control) — misma fuente que mapa y resumen
                const riesgoResidualEval = r.evaluacion!.riesgoResidual;
                const nivelRiesgoResidualEval = r.evaluacion!.nivelRiesgoResidual;
                const calResidualNum =
                    probabilidadResidual != null && impactoResidual != null
                        ? (probabilidadResidual === 2 && impactoResidual === 2 ? 3.99 : probabilidadResidual * impactoResidual)
                        : (riesgoResidualEval != null ? Number(riesgoResidualEval) : undefined);

                return {
                    riesgoId: r.id,
                    descripcion: r.descripcion,
                    probabilidad,
                    impacto,

                    // Residual (posición en mapa y calificación final)
                    probabilidadResidual,
                    impactoResidual,
                    riesgoResidual: riesgoResidualEval != null ? Number(riesgoResidualEval) : calResidualNum,
                    nivelRiesgoResidual: nivelRiesgoResidualEval ?? undefined,

                    nivelRiesgo: r.evaluacion!.nivelRiesgo,
                    clasificacion: r.clasificacion,
                    numero: r.numero,
                    siglaGerencia: r.proceso?.sigla || '',
                    numeroIdentificacion: r.numeroIdentificacion || `${r.numero || r.id}${r.proceso?.sigla || 'R'}`,
                    procesoId: r.procesoId,
                    procesoNombre: r.proceso?.nombre || 'Proceso desconocido'
                };
            });

        res.json(puntos);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching map points' });
    }
};
export const getCausas = async (req: Request, res: Response) => {
    try {
        // Incluir solo causas sin controles anidados para evitar errores de columnas faltantes
        const causas = await prisma.causaRiesgo.findMany({
            // Sin include de controles por ahora para evitar errores
        });
        res.json(causas);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching causas' });
    }
};

/**
 * Función helper para recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
 * cuando se crea, actualiza o elimina una causa, o cuando cambian los pesos de impacto.
 *
 * También es reutilizada desde otros controladores (por ejemplo, al actualizar los pesos
 * en catálogo), por eso se exporta.
 */
export async function recalcularRiesgoInherenteDesdeCausas(riesgoId: number): Promise<void> {
    try {
        // Obtener el riesgo con su evaluación y causas
        const riesgo = await prisma.riesgo.findUnique({
            where: { id: riesgoId },
            include: {
                evaluacion: true,
                causas: true
            }
        });

        if (!riesgo || !riesgo.evaluacion) return;

        // Si no hay causas, establecer a 0
        if (!riesgo.causas || riesgo.causas.length === 0) {
            await prisma.evaluacionRiesgo.update({
                where: { riesgoId },
                data: {
                    riesgoInherente: 0,
                    nivelRiesgo: 'Sin Calificar',
                    probabilidad: 1,
                    impactoGlobal: 1
                }
            });
            return;
        }

        // Obtener pesos de impacto desde la configuración
        let pesosImpacto: Record<string, number> = {
            personas: 0.10,
            legal: 0.22,
            ambiental: 0.10,
            procesos: 0.14,
            reputacion: 0.22,
            economico: 0.22,
            confidencialidadSGSI: 0.0,
            disponibilidadSGSI: 0.0,
            integridadSGSI: 0.0
        };
        
        try {
            const config = await prisma.configuracion.findUnique({
                where: { clave: 'pesos_impacto' }
            });
            
            if (config) {
                const pesosArray = JSON.parse(config.valor) as Array<{ key: string; porcentaje: number }>;
                pesosImpacto = {};
                pesosArray.forEach(p => {
                    pesosImpacto[p.key] = p.porcentaje / 100; // Convertir porcentaje (0-100) a decimal (0-1)
                });
            }
        } catch (error) {
            // Usar valores por defecto
        }
        
        // Calcular calificación global impacto: nivel * porcentaje_decimal, sumar todos, redondear hacia arriba
        const calificacionGlobalImpacto = Math.ceil(
            (Number(riesgo.evaluacion.impactoPersonas || 1) * (pesosImpacto.personas || 0)) +
            (Number(riesgo.evaluacion.impactoLegal || 1) * (pesosImpacto.legal || 0)) +
            (Number(riesgo.evaluacion.impactoAmbiental || 1) * (pesosImpacto.ambiental || 0)) +
            (Number(riesgo.evaluacion.impactoProcesos || 1) * (pesosImpacto.procesos || 0)) +
            (Number(riesgo.evaluacion.impactoReputacion || 1) * (pesosImpacto.reputacion || 0)) +
            (Number(riesgo.evaluacion.impactoEconomico || 1) * (pesosImpacto.economico || 0)) +
            (Number(riesgo.evaluacion.confidencialidadSGSI || 1) * (pesosImpacto.confidencialidadSGSI || 0)) +
            (Number(riesgo.evaluacion.disponibilidadSGSI || 1) * (pesosImpacto.disponibilidadSGSI || 0)) +
            (Number(riesgo.evaluacion.integridadSGSI || 1) * (pesosImpacto.integridadSGSI || 0))
        );

        // Obtener todas las frecuencias del catálogo
        const frecuenciasCatalog = await prisma.frecuenciaCatalog.findMany();

        // Traer configuración de Calificación Inherente (Admin) como única fuente de verdad
        const configInherente = await prisma.calificacionInherenteConfig.findFirst({
            where: { activa: true },
            include: {
                formulaBase: true,
                excepciones: { where: { activa: true }, orderBy: { prioridad: 'asc' } },
                rangos: { where: { activo: true }, orderBy: { orden: 'asc' } },
                reglaAgregacion: true
            }
        });

        const formulaBase = configInherente?.formulaBase;
        const excepciones = configInherente?.excepciones ?? [];
        const rangos = configInherente?.rangos ?? [];
        const tipoAgregacion = (configInherente?.reglaAgregacion?.tipoAgregacion ?? 'maximo').toLowerCase();

        // Calcular calificación inherente por cada causa usando la config (fórmula + excepciones)
        type CausaConEje = { cal: number; frecuenciaEje: number };
        const causasConEje: CausaConEje[] = [];
        for (const causa of riesgo.causas) {
            let pesoFrecuencia = 3;
            if (causa.frecuencia) {
                if (/^\d+$/.test(causa.frecuencia)) {
                    const freqId = parseInt(causa.frecuencia);
                    const freqCatalog = frecuenciasCatalog.find(f => f.id === freqId);
                    // Si peso es 3 (default del catálogo), usar id para escala 1-5 y que Prob×Impacto = Riesgo Inherente
                    const p = freqCatalog?.peso ?? freqId;
                    pesoFrecuencia = (p != null && p !== 3) ? p : (freqCatalog?.id ?? freqId);
                } else {
                    const freqCatalog = frecuenciasCatalog.find(f =>
                        f.label?.toLowerCase() === (causa.frecuencia as string).toLowerCase()
                    );
                    const p = freqCatalog?.peso ?? 3;
                    pesoFrecuencia = (p != null && p !== 3) ? p : (freqCatalog?.id ?? 3);
                }
            }
            let cal: number = calificacionGlobalImpacto * pesoFrecuencia;
            let excepcionAplicada = false;
            if (excepciones.length > 0) {
                for (const ex of excepciones) {
                    const cond = ex.condiciones as Record<string, number>;
                    if (cond.frecuencia === pesoFrecuencia && cond.calificacionGlobalImpacto === calificacionGlobalImpacto) {
                        cal = ex.resultado;
                        excepcionAplicada = true;
                        break;
                    }
                }
            }
            if (!excepcionAplicada && formulaBase) {
                if (formulaBase.tipoOperacion === 'multiplicacion') {
                    cal = calificacionGlobalImpacto * pesoFrecuencia;
                } else if (formulaBase.tipoOperacion === 'suma') {
                    cal = calificacionGlobalImpacto + pesoFrecuencia;
                } else if (formulaBase.tipoOperacion === 'promedio') {
                    cal = (calificacionGlobalImpacto + pesoFrecuencia) / 2;
                }
            }
            const frecuenciaEje = Math.max(1, Math.min(5, Math.round(Number(pesoFrecuencia))));
            causasConEje.push({ cal, frecuenciaEje });
        }

        const calificaciones = causasConEje.map(x => x.cal);
        let calificacionInherenteGlobal: number;
        if (tipoAgregacion === 'maximo' || tipoAgregacion === 'maximum') {
            calificacionInherenteGlobal = calificaciones.length > 0 ? Math.max(...calificaciones) : 0;
        } else if (tipoAgregacion === 'promedio') {
            calificacionInherenteGlobal = calificaciones.length > 0 ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length : 0;
        } else if (tipoAgregacion === 'suma') {
            calificacionInherenteGlobal = calificaciones.reduce((a, b) => a + b, 0);
        } else if (tipoAgregacion === 'minimo') {
            calificacionInherenteGlobal = calificaciones.length > 0 ? Math.min(...calificaciones) : 0;
        } else {
            calificacionInherenteGlobal = calificaciones.length > 0 ? Math.max(...calificaciones) : 0;
        }

        // Nivel de riesgo según rangos de la config (Admin > Calificación Inherente)
        let nivelRiesgo = 'Sin Calificar';
        for (const rango of rangos) {
            const cumpleMin = rango.incluirMinimo ? calificacionInherenteGlobal >= rango.valorMinimo : calificacionInherenteGlobal > rango.valorMinimo;
            const cumpleMax = rango.incluirMaximo ? calificacionInherenteGlobal <= rango.valorMaximo : calificacionInherenteGlobal < rango.valorMaximo;
            if (cumpleMin && cumpleMax) {
                nivelRiesgo = rango.nivelNombre;
                break;
            }
        }

        // Mapa: X = Frecuencia (probabilidad), Y = Impacto. Usar causa que da el máximo y sus ejes reales.
        const impactoEje = Math.max(1, Math.min(5, Math.round(Number(calificacionGlobalImpacto))));
        let probabilidadMapa = 1;
        const impactoMapa = impactoEje;
        if (causasConEje.length > 0) {
            const causaMax = causasConEje.reduce((best, cur) => (cur.cal > best.cal ? cur : best));
            probabilidadMapa = causaMax.frecuenciaEje;
        }

        await prisma.evaluacionRiesgo.update({
            where: { riesgoId },
            data: {
                riesgoInherente: Math.round(calificacionInherenteGlobal),
                nivelRiesgo,
                probabilidad: probabilidadMapa,
                impactoGlobal: impactoMapa
            }
        });
    } catch (error) {
        // No lanzar error para no interrumpir la operación principal
    }
}

export const createCausa = async (req: Request, res: Response) => {
    try {
        const { riesgoId, descripcion, fuenteCausa, frecuencia, seleccionada, tipoGestion, gestion } = req.body;
        const riesgoIdNum = Number(riesgoId);

        if (!riesgoId || (riesgoIdNum !== 0 && !riesgoIdNum)) {
            return res.status(400).json({ error: 'riesgoId es requerido y debe ser un número válido' });
        }
        const descripcionTrim = String(descripcion ?? '').trim() || 'Causa';
        if (!descripcionTrim) {
            return res.status(400).json({ error: 'descripcion es requerida' });
        }

        // Verificar que el riesgo existe antes de crear la causa (evita P2003 genérico)
        const riesgoExiste = await prisma.riesgo.findUnique({
            where: { id: riesgoIdNum },
            select: { id: true }
        });
        if (!riesgoExiste) {
            return res.status(404).json({ error: `Riesgo con id ${riesgoIdNum} no encontrado` });
        }

        const dataCausa: {
            riesgoId: number;
            descripcion: string;
            fuenteCausa: string | null;
            frecuencia: string | null;
            seleccionada: boolean;
            tipoGestion?: string | null;
            gestion?: object | null;
        } = {
            riesgoId: riesgoIdNum,
            descripcion: descripcionTrim,
            fuenteCausa: fuenteCausa != null && String(fuenteCausa).trim() !== '' ? String(fuenteCausa).trim() : null,
            frecuencia: frecuencia != null && String(frecuencia).trim() !== '' ? String(frecuencia) : null,
            seleccionada: seleccionada !== undefined ? Boolean(seleccionada) : true,
        };
        if (tipoGestion != null && String(tipoGestion).trim() !== '') dataCausa.tipoGestion = String(tipoGestion);
        if (gestion != null && typeof gestion === 'object') dataCausa.gestion = gestion;

        let causa: any;
        try {
            causa = await prisma.causaRiesgo.create({
                data: dataCausa
            });
        } catch (createErr: any) {
            // P2002 = Unique constraint failed. Si es en (id), la secuencia de PostgreSQL está desincronizada.
            const isIdConstraint = createErr?.code === 'P2002' && (
                (Array.isArray(createErr?.meta?.target) && createErr.meta.target.includes('id')) ||
                String(createErr?.message || '').includes('`id`')
            );
            if (isIdConstraint) {
                try {
                    await prisma.$executeRawUnsafe(
                        `SELECT setval(pg_get_serial_sequence('"CausaRiesgo"', 'id'), COALESCE((SELECT MAX(id) FROM "CausaRiesgo"), 1) + 1)`
                    );
                    causa = await prisma.causaRiesgo.create({
                        data: dataCausa
                    });
                } catch (retryErr: any) {
                    console.error('[createCausa] retry after sequence reset failed', retryErr?.message);
                    throw createErr;
                }
            } else {
                throw createErr;
            }
        }

        // Recalcular riesgo inherente (no bloquear respuesta si falla)
        recalcularRiesgoInherenteDesdeCausas(riesgoIdNum).catch((err) => {
            console.error('[createCausa] recalcularRiesgoInherenteDesdeCausas', err?.message || err);
        });

        // Si la causa tiene control (CONTROL o AMBOS), recalcular calificación residual y esperar para devolver datos ya guardados en BD
        if (dataCausa.tipoGestion === 'CONTROL' || dataCausa.tipoGestion === 'AMBOS') {
            await recalcularResidualPorRiesgo(riesgoIdNum).catch((err) => {
                console.error('[createCausa] recalcularResidualPorRiesgo', err?.message || err);
            });
            // Re-fetch la causa para devolver gestion con frecuenciaResidual/impactoResidual ya calculados
            causa = await prisma.causaRiesgo.findUnique({ where: { id: causa.id } }) ?? causa;
        }

        // Invalidar caché del listado de riesgos del proceso para que el frontend vea las causas nuevas
        const riesgo = await prisma.riesgo.findUnique({
            where: { id: riesgoIdNum },
            select: { procesoId: true }
        });
        if (riesgo?.procesoId) await invalidarCacheRiesgosProceso(riesgo.procesoId);

        res.status(201).json(causa);
    } catch (error: any) {
        console.error('[createCausa]', error?.message || error);
        console.error('[createCausa] body recibido:', { riesgoId: req.body?.riesgoId, descripcion: req.body?.descripcion ? '(presente)' : '(vacío)', frecuencia: req.body?.frecuencia });
        const msg = error?.message || String(error);
        const code = error?.code;
        res.status(500).json({
            error: 'Error creating causa',
            details: msg,
            ...(code ? { code } : {})
        });
    }
};

/**
 * Actualiza una causa. Soporta:
 * - tipoGestion: 'CONTROL' | 'PLAN' | 'AMBOS' (o null para eliminar clasificación)
 * - gestion: objeto JSON con datos de control y/o plan (cuando AMBOS, incluye ambos conjuntos de campos)
 */
export const updateCausa = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { tipoGestion, gestion, descripcion, fuenteCausa, frecuencia } = req.body;
        const updateData: any = {};
        
        // Campos de gestión: tipoGestion acepta CONTROL, PLAN, AMBOS o null
        if (tipoGestion !== undefined) updateData.tipoGestion = tipoGestion;
        if (gestion !== undefined) updateData.gestion = gestion;
        
        // Campos básicos de causa
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (fuenteCausa !== undefined) updateData.fuenteCausa = fuenteCausa;
        if (frecuencia !== undefined) updateData.frecuencia = frecuencia ? String(frecuencia) : null;
        
        const updated = await prisma.causaRiesgo.update({
            where: { id },
            data: updateData
        });

        // Recalcular riesgo inherente si cambió frecuencia o descripción
        if (frecuencia !== undefined || descripcion !== undefined) {
            await recalcularRiesgoInherenteDesdeCausas(updated.riesgoId);
        }

        // Recalcular calificación residual cuando se guarda/edita un control (usa parámetros del admin)
        let resultado: typeof updated = updated;
        if (tipoGestion !== undefined || gestion !== undefined) {
            await recalcularResidualPorRiesgo(updated.riesgoId).catch(() => {});
            // Devolver la causa con gestion ya recalculado (frecuenciaResidual, impactoResidual, etc.)
            resultado = await prisma.causaRiesgo.findUnique({ where: { id: updated.id } }) ?? updated;
        }

        const riesgo = await prisma.riesgo.findUnique({
            where: { id: updated.riesgoId },
            select: { procesoId: true }
        });
        if (riesgo?.procesoId) await invalidarCacheRiesgosProceso(riesgo.procesoId);

        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: 'Error updating causa' });
    }
};

export const deleteCausa = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        // Verificar que la causa existe antes de intentar eliminarla
        const causa = await prisma.causaRiesgo.findUnique({
            where: { id }
        });
        
        if (!causa) return res.status(404).json({ error: `Causa con id ${id} no encontrada` });
        
        const riesgoId = causa.riesgoId;
        
        await prisma.causaRiesgo.delete({
            where: { id }
        });

        await recalcularRiesgoInherenteDesdeCausas(riesgoId);
        // Recalcular residual: si ya no queda ninguna causa con control, residual = inherente
        await recalcularResidualPorRiesgo(riesgoId).catch(() => {});

        const riesgo = await prisma.riesgo.findUnique({
            where: { id: riesgoId },
            select: { procesoId: true }
        });
        if (riesgo?.procesoId) await invalidarCacheRiesgosProceso(riesgo.procesoId);

        res.json({ message: 'Causa eliminada correctamente', id });
    } catch (error: any) {
        // Si es un error de Prisma (causa no encontrada)
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Causa con id ${id} no encontrada` });
        }
        res.status(500).json({ error: 'Error deleting causa', details: error.message });
    }
};
