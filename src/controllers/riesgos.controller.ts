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
        
        // Construir include de forma segura - solo relaciones básicas que sabemos que existen
        const include: any = {
            evaluacion: true,
            proceso: true  // Incluir proceso completo sin select específico para evitar errores
        };
        
        // Incluir causas si se solicita, pero de forma segura
        if (includeCausasFlag) {
            include.causas = true;  // Solo incluir causas, sin controles anidados por ahora
        }
        
        const [riesgos, total] = await Promise.all([
            prisma.riesgo.findMany({
                where,
                take,
                skip,
                include,
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

        // Solo actualizar evaluación si ya existe (no crear nueva)
        if (Object.keys(evaluacionUpdate).length > 0) {
            const existingEval = await prisma.evaluacionRiesgo.findUnique({
                where: { riesgoId: id }
            });
            if (existingEval) {
                const evaluacionActualizada = await prisma.evaluacionRiesgo.update({
                    where: { riesgoId: id },
                    data: { ...evaluacionUpdate }
                });
                console.log('[BACKEND] Evaluacion actualizada con valores residuales:', {
                    riesgoId: id,
                    riesgoResidual: evaluacionActualizada.riesgoResidual,
                    probabilidadResidual: evaluacionActualizada.probabilidadResidual,
                    impactoResidual: evaluacionActualizada.impactoResidual,
                    nivelRiesgoResidual: evaluacionActualizada.nivelRiesgoResidual
                });
            } else {
                console.warn('[BACKEND] No se encontró evaluación para riesgo:', id);
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
                
                // Calcular probabilidad e impacto desde riesgoInherente o valores directos
                const riesgoInherente = r.evaluacion!.riesgoInherente;
                if (riesgoInherente && riesgoInherente > 0 && !isNaN(riesgoInherente)) {
                    // Convertir riesgoInherente a probabilidad e impacto
                    // Primero buscar coincidencia exacta, luego el más cercano >=
                    let mejorProb = 1;
                    let mejorImp = 1;
                    let encontradoExacto = false;
                    
                    // Primero buscar coincidencia exacta
                    for (let prob = 1; prob <= 5; prob++) {
                        for (let imp = 1; imp <= 5; imp++) {
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
