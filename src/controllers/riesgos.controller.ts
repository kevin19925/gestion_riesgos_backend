import { Request, Response } from 'express';
import prisma from '../prisma';
import { redisGet, redisSet } from '../redisClient';

export const getRiesgos = async (req: Request, res: Response) => {
    const { procesoId, clasificacion, busqueda, page, pageSize, zona, includeCausas } = req.query;
    const where: any = {};
    if (procesoId) {
        const parsedProcesoId = Number(procesoId);
        if (!isNaN(parsedProcesoId) && parsedProcesoId > 0) {
            where.procesoId = parsedProcesoId;
        }
    }
    // OPTIMIZADO: Filtro de clasificación - usar evaluacion.nivelRiesgo de forma segura
    // Nota: Si hay un filtro de clasificación, solo mostrar riesgos que tengan evaluación
    if (clasificacion && clasificacion !== 'all') {
        where.evaluacion = {
            nivelRiesgo: String(clasificacion)
        };
    }
    if (zona) where.zona = String(zona);
    if (busqueda) {
        where.OR = [
            { descripcion: { contains: String(busqueda), mode: 'insensitive' } },
            { numeroIdentificacion: { contains: String(busqueda), mode: 'insensitive' } },
        ];
    }

    // OPTIMIZADO: Paginación robusta con validación
    const pageNum = Math.max(1, Number(page) || 1); // Mínimo página 1
    const requestedPageSize = Number(pageSize) || 50;
    const take = Math.min(Math.max(1, requestedPageSize), 100); // Entre 1 y 100
    const skip = (pageNum - 1) * take;

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
            evaluacion: true, // Incluir toda la evaluación (necesaria para cálculos)
            proceso: {
                select: {
                    id: true,
                    nombre: true,
                    sigla: true,
                }
            }
        };
        
        // Incluir causas solo si se solicita, limitadas para evitar sobrecarga
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
        
        // OPTIMIZADO: Validar que take y skip sean válidos antes de ejecutar
        if (take <= 0 || take > 100) {
            return res.status(400).json({ 
                error: 'Invalid pageSize', 
                message: 'pageSize must be between 1 and 100' 
            });
        }
        
        if (skip < 0) {
            return res.status(400).json({ 
                error: 'Invalid page', 
                message: 'page must be >= 1' 
            });
        }

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

        // Calcular totalPages de forma segura
        const totalPages = total > 0 ? Math.ceil(total / take) : 0;

        const payload = {
            data: riesgos,
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

        // OPTIMIZADO: Usar select específico y limitar causas
        const riesgo = await prisma.riesgo.findUnique({
            where: { id },
            select: {
                id: true,
                procesoId: true,
                numero: true,
                descripcion: true,
                clasificacion: true,
                zona: true,
                numeroIdentificacion: true,
                tipologiaNivelI: true,
                tipologiaNivelII: true,
                tipoRiesgoId: true,
                subtipoRiesgoId: true,
                objetivoId: true,
                causaRiesgo: true,
                fuenteCausa: true,
                origen: true,
                vicepresidenciaGerenciaAlta: true,
                siglaVicepresidencia: true,
                gerencia: true,
                siglaGerencia: true,
                createdAt: true,
                updatedAt: true,
                subtipoRiesgo: true,
                tipoRiesgo: true,
                evaluacion: true,
                // OPTIMIZADO: Limitar causas a 20 más recientes
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
                        orden: true,
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
        
        // OPTIMIZADO: Cachear por 2 minutos
        await redisSet(cacheKey, riesgo, 120);
        
        res.json(riesgo);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching riesgo' });
    }
};

export const createRiesgo = async (req: Request, res: Response) => {
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

        // Create evaluation data if provided (normalize Int/String for Prisma)
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
        
        // OPTIMIZADO: Invalidar caché relacionado
        await redisSet(`riesgos:proceso:${riesgoData.procesoId}:page:1:size:50:causas:false`, null, 0);
        
        res.json(nuevoRiesgo);
    } catch (error: any) {
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
    let { evaluacion, causas, priorizacion, ...data } = req.body;
    try {
        if (data.procesoId) data.procesoId = Number(data.procesoId);

        // Mover campos de evaluación residual si vienen en el body raíz o en evaluacion
        const evaluacionFields = ['riesgoResidual', 'probabilidadResidual', 'impactoResidual', 'nivelRiesgoResidual'];
        const evaluacionUpdate: any = { ...evaluacion };
        evaluacionFields.forEach(field => {
            if (data[field] !== undefined) {
                evaluacionUpdate[field] = data[field];
                delete data[field];
            }
            // También verificar si viene en el objeto evaluacion
            if (evaluacion && evaluacion[field] !== undefined) {
                evaluacionUpdate[field] = evaluacion[field];
            }
        });

        const updated = await prisma.riesgo.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
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

        // OPTIMIZADO: Invalidar caché relacionado
        await redisSet(`riesgo:${id}`, null, 0);
        if (updated.procesoId) {
            await redisSet(`riesgos:proceso:${updated.procesoId}:page:1:size:50:causas:false`, null, 0);
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
        
        // OPTIMIZADO: Invalidar caché relacionado
        await redisSet(`riesgo:${id}`, null, 0);
        if (riesgo?.procesoId) {
            await redisSet(`riesgos:proceso:${riesgo.procesoId}:page:1:size:50:causas:false`, null, 0);
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
                // Representan los ejes reales del mapa: X = Frecuencia (probabilidad), Y = Impacto.
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
                
                // Calcular valores residuales
                // PRIORIDAD 1: Si hay riesgoResidual en la evaluación (clasificación residual global), calcular desde ahí
                let probabilidadResidual: number | null = null;
                let impactoResidual: number | null = null;
                
                const riesgoResidual = r.evaluacion!.riesgoResidual;
                if (riesgoResidual && riesgoResidual > 0 && !isNaN(riesgoResidual)) {
                    // Convertir riesgoResidual a probabilidad e impacto (mismo algoritmo que para inherente)
                    let mejorProbRes = 1;
                    let mejorImpRes = 1;
                    let encontradoExacto = false;
                    
                    // Primero buscar coincidencia exacta
                    for (let prob = 1; prob <= 5; prob++) {
                        for (let imp = 1; imp <= 5; imp++) {
                            const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                            if (Math.abs(valor - riesgoResidual) < 0.01) {
                                mejorProbRes = prob;
                                mejorImpRes = imp;
                                encontradoExacto = true;
                                break;
                            }
                        }
                        if (encontradoExacto) break;
                    }
                    
                    // Si no hay coincidencia exacta, buscar el más cercano >= riesgoResidual
                    if (!encontradoExacto) {
                        let menorDiferencia = Infinity;
                        for (let prob = 1; prob <= 5; prob++) {
                            for (let imp = 1; imp <= 5; imp++) {
                                const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                
                                // Priorizar valores que sean >= riesgoResidual
                                if (valor >= riesgoResidual) {
                                    const diferencia = valor - riesgoResidual;
                                    if (diferencia < menorDiferencia) {
                                        menorDiferencia = diferencia;
                                        mejorProbRes = prob;
                                        mejorImpRes = imp;
                                    }
                                }
                            }
                        }
                        
                        // Si aún no hay valor >=, usar el más cercano
                        if (menorDiferencia === Infinity) {
                            for (let prob = 1; prob <= 5; prob++) {
                                for (let imp = 1; imp <= 5; imp++) {
                                    const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                    const diferencia = Math.abs(riesgoResidual - valor);
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
                    // PRIORIDAD 2: Si no hay riesgoResidual, usar valores residuales directos de la evaluación
                    probabilidadResidual = r.evaluacion!.probabilidadResidual 
                        ? Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.probabilidadResidual))))
                        : null;
                    impactoResidual = r.evaluacion!.impactoResidual
                        ? Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.impactoResidual))))
                        : null;
                    
                }
                
                // PRIORIDAD 3: Si aún no hay valores residuales, usar inherentes
                if (!probabilidadResidual || !impactoResidual) {
                    probabilidadResidual = probabilidad;
                    impactoResidual = impacto;
                }
                
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
                    siglaGerencia: r.proceso?.sigla || r.siglaGerencia || '', // Usar sigla del proceso, fallback a siglaGerencia por compatibilidad
                    numeroIdentificacion: r.numeroIdentificacion || `${r.numero || r.id}${r.proceso?.sigla || 'R'}`,
                    procesoId: r.procesoId,
                    procesoNombre: r.proceso?.nombre || 'Proceso desconocido',
                    // Campos adicionales del riesgo
                    zona: r.zona || null,
                    tipologiaNivelI: r.tipologiaNivelI || null
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
        
        // Recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
        await recalcularRiesgoInherenteDesdeCausas(Number(riesgoId));
        
        res.status(201).json(causa);
    } catch (error) {
        res.status(500).json({ error: 'Error creating causa' });
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
        
        // Recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
        // Solo si se modificó frecuencia o si puede afectar el cálculo
        if (frecuencia !== undefined || descripcion !== undefined) {
            await recalcularRiesgoInherenteDesdeCausas(updated.riesgoId);
        }
        
        res.json(updated);
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
        
        // Recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
        await recalcularRiesgoInherenteDesdeCausas(riesgoId);
        
        res.json({ message: 'Causa eliminada correctamente', id });
    } catch (error: any) {
        // Si es un error de Prisma (causa no encontrada)
        if (error.code === 'P2025') {
            return res.status(404).json({ error: `Causa con id ${id} no encontrada` });
        }
        res.status(500).json({ error: 'Error deleting causa', details: error.message });
    }
};
