import { Request, Response } from 'express';
import prisma from '../prisma';

export const getRiesgos = async (req: Request, res: Response) => {
    const { procesoId, clasificacion, busqueda, page, pageSize, zona, includeCausas } = req.query;
    // OPTIMIZADO: Reducir logging en producción para mejor rendimiento
    if (process.env.NODE_ENV === 'development') {
        console.log('[BACKEND] getRiesgos - query:', JSON.stringify(req.query, null, 2));
    }
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
        const includeCausasFlag = String(includeCausas) === 'true';
        
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

        res.json({
            data: riesgos,
            total,
            page: pageNum,
            pageSize: take,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPreviousPage: pageNum > 1
        });
    } catch (error: any) {
        console.error('[BACKEND] Error in getRiesgos:', error);
        console.error('[BACKEND] Error stack:', error?.stack);
        console.error('[BACKEND] Error details:', {
            message: error?.message,
            code: error?.code,
            meta: error?.meta
        });
        res.status(500).json({ 
            error: 'Error fetching riesgos',
            message: error?.message || 'Unknown error',
            code: error?.code
        });
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
                causas: true,  // Incluir causas sin controles anidados por ahora
                priorizacion: {
                    include: {
                        planesAccion: true
                    }
                },
                proceso: true  // Incluir proceso completo sin select específico
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
        
        console.log('[BACKEND] updateRiesgo - evaluacionUpdate:', JSON.stringify(evaluacionUpdate, null, 2));

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
                const evaluacionActualizada = await prisma.evaluacionRiesgo.update({
                    where: { riesgoId: id },
                    data: { 
                        ...evaluacionUpdate
                    }
                });
                console.log('[BACKEND] Evaluacion actualizada:', {
                    riesgoId: id,
                    riesgoInherente: evaluacionActualizada.riesgoInherente,
                    nivelRiesgo: evaluacionActualizada.nivelRiesgo,
                    probabilidad: evaluacionActualizada.probabilidad,
                    impactoGlobal: evaluacionActualizada.impactoGlobal,
                    riesgoResidual: evaluacionActualizada.riesgoResidual,
                    probabilidadResidual: evaluacionActualizada.probabilidadResidual,
                    impactoResidual: evaluacionActualizada.impactoResidual,
                    nivelRiesgoResidual: evaluacionActualizada.nivelRiesgoResidual
                });
            } else {
                // Crear nueva evaluación si no existe
                const nuevaEvaluacion = await prisma.evaluacionRiesgo.create({
                    data: {
                        riesgoId: id,
                        ...evaluacionUpdate
                    }
                });
                console.log('[BACKEND] Nueva evaluación creada:', {
                    riesgoId: id,
                    riesgoInherente: nuevaEvaluacion.riesgoInherente,
                    nivelRiesgo: nuevaEvaluacion.nivelRiesgo,
                    probabilidad: nuevaEvaluacion.probabilidad,
                    impactoGlobal: nuevaEvaluacion.impactoGlobal
                });
            }
        }

        // Si se actualizaron los impactos, recalcular automáticamente riesgoInherente desde causas
        const camposImpacto = ['impactoPersonas', 'impactoLegal', 'impactoAmbiental', 'impactoProcesos', 
                               'impactoReputacion', 'impactoEconomico', 'confidencialidadSGSI', 
                               'disponibilidadSGSI', 'integridadSGSI'];
        const seActualizaronImpactos = evaluacionUpdate && camposImpacto.some(campo => evaluacionUpdate[campo] !== undefined);
        
        if (seActualizaronImpactos) {
            console.log(`[BACKEND] Se actualizaron impactos para riesgo ${id}, recalculando automáticamente...`);
            await recalcularRiesgoInherenteDesdeCausas(id);
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
    console.log(`[BACKEND] getPuntosMapa - procesoId: ${procesoId || 'TODOS (sin filtro)'}`);
    const where: any = {};
    // Solo filtrar por proceso si se especifica explícitamente
    if (procesoId && procesoId !== 'all' && procesoId !== 'undefined' && procesoId !== 'null') {
        where.procesoId = Number(procesoId);
    }
    // Si no hay procesoId o es 'all', where estará vacío y se obtendrán TODOS los riesgos

    try {
        // Incluir TODAS las causas para calcular correctamente los valores residuales
        const riesgos = await prisma.riesgo.findMany({
            where,
            include: { 
                evaluacion: true, 
                proceso: true,
                causas: true  // Incluir TODAS las causas, no solo las con controles
            }
        });
        
        console.log(`[BACKEND] getPuntosMapa - ${riesgos.length} riesgos encontrados`);

        // Incluir TODOS los riesgos con evaluación (no filtrar por valores específicos)
        // IMPORTANTE: Solo generar UN punto por riesgo (evitar duplicados)
        const riesgosProcesados = new Set<number>();
        const puntos = riesgos
            .filter(r => {
                // Solo incluir riesgos con evaluación
                if (!r.evaluacion) {
                    console.warn(`[BACKEND] Riesgo ${r.id} sin evaluación, excluido del mapa`);
                    return false;
                }
                // Evitar duplicados: si este riesgo ya fue procesado, saltarlo
                if (riesgosProcesados.has(r.id)) {
                    console.warn(`[BACKEND] Riesgo ${r.id} duplicado, excluido`);
                    return false;
                }
                // Incluir todos los riesgos con evaluación, incluso si no tienen valores perfectos
                // El cálculo se hará después con fallbacks
                riesgosProcesados.add(r.id);
                return true;
            })
            .map(r => {
                let probabilidad: number;
                let impacto: number;
                
                // SIEMPRE calcular probabilidad e impacto desde riesgoInherente para garantizar consistencia
                // Ignorar valores guardados en probabilidad e impactoGlobal si hay riesgoInherente
                const riesgoInherente = r.evaluacion!.riesgoInherente;
                if (riesgoInherente && riesgoInherente > 0 && !isNaN(riesgoInherente)) {
                    // Convertir riesgoInherente a probabilidad e impacto
                    // Primero buscar coincidencia exacta, luego el más cercano >=
                    let mejorProb = 1;
                    let mejorImp = 1;
                    let encontradoExacto = false;
                    
                    // Primero buscar coincidencia exacta
                    // IMPORTANTE: Priorizar combinaciones balanceadas (prob == imp)
                    // Para riesgoInherente = 16, preferir 4×4 sobre otras combinaciones
                    // Para riesgoInherente = 4, preferir 2×2 sobre 1×4 o 4×1
                    // Buscar primero combinaciones balanceadas (prob == imp), luego otras
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
                    
                    // Si no encontramos balanceada, buscar cualquier coincidencia exacta
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
                    
                    // Si no hay coincidencia exacta, buscar el más cercano >= riesgoInherente
                    if (!encontradoExacto) {
                        let menorDiferencia = Infinity;
                        for (let prob = 1; prob <= 5; prob++) {
                            for (let imp = 1; imp <= 5; imp++) {
                                const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                                
                                // Priorizar valores que sean >= riesgoInherente (no menores)
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
                        
                        // Si aún no hay valor >=, usar el más cercano (menor)
                        if (menorDiferencia === Infinity) {
                            menorDiferencia = Infinity;
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
                    
                    // Log para debugging: verificar si hay inconsistencia con valores guardados
                    const probGuardada = Number(r.evaluacion!.probabilidad);
                    const impGuardado = Number(r.evaluacion!.impactoGlobal);
                    if ((probGuardada && Math.abs(probGuardada - probabilidad) > 0.1) || 
                        (impGuardado && Math.abs(impGuardado - impacto) > 0.1)) {
                        console.log(`[BACKEND] ⚠️ Riesgo ${r.id}: Inconsistencia detectada. ` +
                            `riesgoInherente=${riesgoInherente} -> Calculado: Prob=${probabilidad}, Imp=${impacto} ` +
                            `vs Guardado: Prob=${probGuardada}, Imp=${impGuardado}`);
                    }
                    
                    // Log siempre para debugging
                    console.log(`[BACKEND] Riesgo ${r.id} (${r.numeroIdentificacion || r.id}): ` +
                        `riesgoInherente=${riesgoInherente} -> Prob=${probabilidad}, Imp=${impacto} ` +
                        `(verificación: ${probabilidad}×${impacto}=${probabilidad === 2 && impacto === 2 ? 3.99 : probabilidad * impacto})`);
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
                    
                    console.log(`[BACKEND] Riesgo ${r.id}: Valores residuales desde riesgoResidual=${riesgoResidual} -> Prob=${probabilidadResidual}, Imp=${impactoResidual}`);
                } else {
                    // PRIORIDAD 2: Si no hay riesgoResidual, usar valores residuales directos de la evaluación
                    probabilidadResidual = r.evaluacion!.probabilidadResidual 
                        ? Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.probabilidadResidual))))
                        : null;
                    impactoResidual = r.evaluacion!.impactoResidual
                        ? Math.max(1, Math.min(5, Math.round(Number(r.evaluacion!.impactoResidual))))
                        : null;
                    
                    if (probabilidadResidual && impactoResidual) {
                        console.log(`[BACKEND] Riesgo ${r.id}: Valores residuales directos de evaluación - Prob=${probabilidadResidual}, Imp=${impactoResidual}`);
                    }
                }
                
                // PRIORIDAD 3: Si aún no hay valores residuales, usar inherentes
                // (Esto es para riesgos sin controles, que deben aparecer igual en ambos mapas)
                if (!probabilidadResidual || !impactoResidual) {
                    probabilidadResidual = probabilidad;
                    impactoResidual = impacto;
                    console.log(`[BACKEND] Riesgo ${r.id}: Sin valores residuales, usando inherentes - Prob=${probabilidadResidual}, Imp=${impactoResidual}`);
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
        
        console.log(`[BACKEND] getPuntosMapa - ${puntos.length} puntos válidos generados de ${riesgos.length} riesgos totales`);
        
        // Log detallado de los primeros 5 puntos para debug
        puntos.slice(0, 5).forEach((p: any) => {
            console.log(`[BACKEND] Punto: riesgoId=${p.riesgoId}, id=${p.numeroIdentificacion}, inherente=${p.probabilidad}-${p.impacto}, residual=${p.probabilidadResidual}-${p.impactoResidual}`);
        });

        res.json(puntos);
    } catch (error) {
        console.error('[BACKEND] Error in getPuntosMapa:', error);
        res.status(500).json({ error: 'Error fetching map points' });
    }
};
export const getCausas = async (req: Request, res: Response) => {
    console.log('[BACKEND] getCausas');
    try {
        // Incluir solo causas sin controles anidados para evitar errores de columnas faltantes
        const causas = await prisma.causaRiesgo.findMany({
            // Sin include de controles por ahora para evitar errores
        });
        res.json(causas);
    } catch (error) {
        console.error('[BACKEND] Error in getCausas:', error);
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

        if (!riesgo || !riesgo.evaluacion) {
            console.log(`[BACKEND] ⚠️ Riesgo ${riesgoId} no tiene evaluación, saltando recálculo`);
            return;
        }

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
            console.log(`[BACKEND] Riesgo ${riesgoId}: Sin causas, establecido a 0`);
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
            console.error('[BACKEND] Error obteniendo pesos de impacto, usando valores por defecto:', error);
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

        // Calcular calificación inherente por cada causa
        const calificacionesInherentes: number[] = [];
        for (const causa of riesgo.causas) {
            // Obtener peso de frecuencia
            let pesoFrecuencia = 3; // Default
            if (causa.frecuencia) {
                // Intentar buscar por ID
                if (/^\d+$/.test(causa.frecuencia)) {
                    const freqId = parseInt(causa.frecuencia);
                    const freqCatalog = frecuenciasCatalog.find(f => f.id === freqId);
                    pesoFrecuencia = freqCatalog?.peso || freqId;
                } else {
                    // Buscar por label
                    const freqCatalog = frecuenciasCatalog.find(f => 
                        f.label?.toLowerCase() === causa.frecuencia.toLowerCase()
                    );
                    pesoFrecuencia = freqCatalog?.peso || 3;
                }
            }

            // Calcular calificación inherente por causa (aplicar excepción 2x2=3.99)
            let calificacionInherentePorCausa: number;
            if (pesoFrecuencia === 2 && calificacionGlobalImpacto === 2) {
                calificacionInherentePorCausa = 3.99;
            } else {
                calificacionInherentePorCausa = calificacionGlobalImpacto * pesoFrecuencia;
            }

            calificacionesInherentes.push(calificacionInherentePorCausa);
        }

        // Calcular máximo de todas las causas
        const maxCalificacionInherente = calificacionesInherentes.length > 0
            ? Math.max(...calificacionesInherentes)
            : 0;

        // Determinar nivel de riesgo (simplificado - usar rangos estándar)
        let nivelRiesgo = 'Sin Calificar';
        if (maxCalificacionInherente >= 15 && maxCalificacionInherente <= 25) {
            nivelRiesgo = 'Crítico';
        } else if (maxCalificacionInherente >= 10 && maxCalificacionInherente <= 14) {
            nivelRiesgo = 'Alto';
        } else if (maxCalificacionInherente >= 4 && maxCalificacionInherente <= 9) {
            nivelRiesgo = 'Medio';
        } else if ((maxCalificacionInherente >= 1 && maxCalificacionInherente <= 3) || maxCalificacionInherente === 3.99) {
            nivelRiesgo = 'Bajo';
        }

        // Convertir riesgoInherente a probabilidad e impacto (priorizando combinaciones balanceadas)
        let mejorProb = 1;
        let mejorImp = 1;
        let encontradoExacto = false;

        // Primero buscar combinaciones balanceadas (prob == imp)
        for (let prob = 5; prob >= 1; prob--) {
            const imp = prob;
            const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
            if (Math.abs(valor - maxCalificacionInherente) < 0.01) {
                mejorProb = prob;
                mejorImp = imp;
                encontradoExacto = true;
                break;
            }
        }

        // Si no encontramos balanceada, buscar cualquier coincidencia exacta
        if (!encontradoExacto) {
            for (let imp = 5; imp >= 1; imp--) {
                for (let prob = 1; prob <= 5; prob++) {
                    const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                    if (Math.abs(valor - maxCalificacionInherente) < 0.01) {
                        mejorProb = prob;
                        mejorImp = imp;
                        encontradoExacto = true;
                        break;
                    }
                }
                if (encontradoExacto) break;
            }
        }

        // Si no hay coincidencia exacta, buscar el más cercano >=
        if (!encontradoExacto) {
            let menorDiferencia = Infinity;
            for (let prob = 1; prob <= 5; prob++) {
                for (let imp = 1; imp <= 5; imp++) {
                    const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                    if (valor >= maxCalificacionInherente) {
                        const diferencia = valor - maxCalificacionInherente;
                        if (diferencia < menorDiferencia) {
                            menorDiferencia = diferencia;
                            mejorProb = prob;
                            mejorImp = imp;
                        }
                    }
                }
            }

            // Si aún no hay valor >=, usar el más cercano
            if (menorDiferencia === Infinity) {
                menorDiferencia = Infinity;
                for (let prob = 1; prob <= 5; prob++) {
                    for (let imp = 1; imp <= 5; imp++) {
                        const valor = prob === 2 && imp === 2 ? 3.99 : prob * imp;
                        const diferencia = Math.abs(maxCalificacionInherente - valor);
                        if (diferencia < menorDiferencia) {
                            menorDiferencia = diferencia;
                            mejorProb = prob;
                            mejorImp = imp;
                        }
                    }
                }
            }
        }

        // Actualizar evaluación - guardar el impacto global calculado con los nuevos pesos
        await prisma.evaluacionRiesgo.update({
            where: { riesgoId },
            data: {
                riesgoInherente: Math.round(maxCalificacionInherente),
                nivelRiesgo,
                probabilidad: mejorProb,
                impactoGlobal: calificacionGlobalImpacto // Guardar el impacto global calculado (redondeado hacia arriba)
            }
        });

        console.log(`[BACKEND] ✅ Riesgo ${riesgoId}: Recalculado automáticamente - riesgoInherente=${Math.round(maxCalificacionInherente)}, Prob=${mejorProb}, ImpGlobal=${calificacionGlobalImpacto} (redondeado hacia arriba), Nivel=${nivelRiesgo}`);
    } catch (error) {
        console.error(`[BACKEND] ❌ Error al recalcular riesgo ${riesgoId} desde causas:`, error);
        // No lanzar error para no interrumpir la operación principal
    }
}

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
        
        // Recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
        await recalcularRiesgoInherenteDesdeCausas(Number(riesgoId));
        
        res.status(201).json(causa);
    } catch (error) {
        console.error('[BACKEND] Error in createCausa:', error);
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
    console.log('[BACKEND] updateCausa - id:', id, 'body:', req.body);
    try {
        const { tipoGestion, gestion, descripcion, fuenteCausa, frecuencia } = req.body;
        const updateData: any = {};
        
        // Campos de gestión: tipoGestion acepta CONTROL, PLAN, AMBOS o null
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
        
        // Recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
        // Solo si se modificó frecuencia o si puede afectar el cálculo
        if (frecuencia !== undefined || descripcion !== undefined) {
            await recalcularRiesgoInherenteDesdeCausas(updated.riesgoId);
        }
        
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
        
        const riesgoId = causa.riesgoId;
        
        await prisma.causaRiesgo.delete({
            where: { id }
        });
        console.log('[BACKEND] Causa eliminada exitosamente:', id);
        
        // Recalcular automáticamente riesgoInherente, probabilidad e impactoGlobal
        await recalcularRiesgoInherenteDesdeCausas(riesgoId);
        
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
