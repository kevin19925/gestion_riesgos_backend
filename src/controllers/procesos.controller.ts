import { Request, Response } from 'express';
import prisma from '../prisma';
import { getDeleteErrorMessage, isPrismaSchemaColumnMissing } from '../utils/prismaErrors';
import { redisGet, redisSet, redisDel } from '../redisClient';
import { recalcularResidualPorRiesgo } from '../services/recalculoResidual.service';

/** Select de listado sin `calificacionModo` (fallback si la migración aún no está en BD). */
const PROCESO_LIST_SELECT_BASE = {
    id: true,
    nombre: true,
    descripcion: true,
    objetivo: true,
    tipo: true,
    responsableId: true,
    areaId: true,
    vicepresidencia: true,
    gerenciaId: true,
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
            email: true,
        },
    },
    gerencia: {
        select: {
            id: true,
            nombre: true,
        },
    },
    responsables: {
        select: {
            modo: true,
            usuario: {
                select: {
                    id: true,
                    nombre: true,
                    email: true,
                    roleRelacion: {
                        select: {
                            codigo: true,
                            nombre: true,
                        },
                    },
                },
            },
        },
    },
    area: {
        select: {
            id: true,
            nombre: true,
            director: {
                select: {
                    id: true,
                    nombre: true,
                    email: true,
                },
            },
        },
    },
    participantes: {
        select: {
            id: true,
            nombre: true,
            email: true,
        },
    },
} as const;

/** Respuesta de update cuando la BD no tiene `calificacionModo` (evita RETURNING de columnas inexistentes). */
const PROCESO_UPDATE_SELECT_SIN_RESIDUAL = {
    id: true,
    nombre: true,
    descripcion: true,
    objetivo: true,
    tipo: true,
    responsableId: true,
    areaId: true,
    vicepresidencia: true,
    estado: true,
    activo: true,
    analisis: true,
    documentoUrl: true,
    documentoNombre: true,
    documentoCaracterizacionUrl: true,
    documentoCaracterizacionNombre: true,
    documentoFlujoGramaUrl: true,
    documentoFlujoGramaNombre: true,
    createdAt: true,
    updatedAt: true,
    sigla: true,
    gerenciaId: true,
    dofaItems: true,
    normatividades: true,
    contextos: true,
    contextoItems: true,
    participantes: true,
} as const;

/** Select detalle de proceso (sin calificacionModo) si la migración aún no está en BD. */
const PROCESO_BY_ID_SELECT_NO_RESIDUAL = {
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
    documentoCaracterizacionUrl: true,
    documentoCaracterizacionNombre: true,
    documentoFlujoGramaUrl: true,
    documentoFlujoGramaNombre: true,
    createdAt: true,
    updatedAt: true,
    sigla: true,
    responsable: {
        select: {
            id: true,
            nombre: true,
            email: true,
        },
    },
    responsables: {
        select: {
            modo: true,
            usuario: {
                select: {
                    id: true,
                    nombre: true,
                    email: true,
                },
            },
        },
    },
    area: {
        select: {
            id: true,
            nombre: true,
            director: {
                select: {
                    id: true,
                    nombre: true,
                    email: true,
                },
            },
        },
    },
    riesgos: {
        select: {
            id: true,
            numero: true,
            descripcion: true,
            numeroIdentificacion: true,
            clasificacion: true,
            tipologiaTipo1Id: true,
            tipologiaTipo2Id: true,
        },
        take: 100,
    },
    dofaItems: { select: { id: true, tipo: true, descripcion: true } },
    normatividades: {
        select: {
            id: true,
            numero: true,
            nombre: true,
            estado: true,
            regulador: true,
            sanciones: true,
            plazoImplementacion: true,
            cumplimiento: true,
            detalleIncumplimiento: true,
            riesgoIdentificado: true,
            clasificacion: true,
            comentarios: true,
            responsable: true,
        },
    },
    contextos: { select: { id: true, tipo: true, descripcion: true } },
    contextoItems: {
        select: {
            id: true,
            tipo: true,
            signo: true,
            descripcion: true,
            enviarADofa: true,
            dofaDimension: true,
        },
    },
    participantes: {
        select: {
            id: true,
            nombre: true,
            email: true,
        },
    },
} as const;

export const getProcesos = async (req: Request, res: Response) => {
    try {
        // OPTIMIZADO: Caché Redis para reducir queries repetidas
        const cacheKey = 'procesos:all';
        const cached = await redisGet<any>(cacheKey);
        if (cached) return res.json(cached);

        let procesos: any[];
        try {
            procesos = await prisma.proceso.findMany({
                take: 2000,
                orderBy: { createdAt: 'desc' },
                select: { ...PROCESO_LIST_SELECT_BASE, calificacionModo: true },
            });
        } catch (firstErr: unknown) {
            if (!isPrismaSchemaColumnMissing(firstErr)) throw firstErr;
            console.warn(
                '[procesos/getProcesos] Columna calificacionModo no encontrada; respuesta sin columna (ESTANDAR por defecto). Ejecute migraciones Prisma.'
            );
            await redisDel(cacheKey).catch(() => {});
            procesos = await prisma.proceso.findMany({
                take: 2000,
                orderBy: { createdAt: 'desc' },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                select: PROCESO_LIST_SELECT_BASE as any,
            });
        }

        // Mapear para agregar areaNombre, gerenciaNombre y lista de responsables para facilitar uso en frontend
        const procesosConAreaNombre = procesos.map((p: any) => {
            const responsablesList = (p.responsables || [])
                .map((r: any) => {
                    const u = r?.usuario;
                    if (!u?.id) return null;
                    const modo = r.modo !== undefined ? r.modo : null;
                    return {
                        id: u.id,
                        nombre: u.nombre,
                        email: u.email,
                        role: u.roleRelacion?.codigo || null,
                        modo,
                    };
                })
                .filter(Boolean);

            return {
                ...p,
                areaNombre: p.area?.nombre || null,
                gerenciaNombre: p.gerencia?.nombre || null,
                responsablesList,
                calificacionModo: p.calificacionModo ?? 'ESTANDAR',
            };
        });

        // OPTIMIZADO: Cachear resultado por 5 minutos (si Redis falla, responder igual)
        try {
            await redisSet(cacheKey, procesosConAreaNombre, 300);
        } catch (_) {
            // ignorar fallo de cache
        }
        res.json(procesosConAreaNombre);
    } catch (error: any) {
        console.error('[procesos/getProcesos]', error?.message ?? error);
        res.status(500).json({
            error: 'Error al cargar procesos',
            ...(process.env.NODE_ENV !== 'production' && {
                details: error?.message ?? String(error),
            }),
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

        const selectFull = {
            ...PROCESO_BY_ID_SELECT_NO_RESIDUAL,
            calificacionModo: true as const,
        };

        let proceso: any;
        try {
            proceso = await prisma.proceso.findUnique({
                where: { id: procesoId },
                select: selectFull,
            });
        } catch (firstErr: unknown) {
            if (!isPrismaSchemaColumnMissing(firstErr)) throw firstErr;
            console.warn(
                '[procesos/getProcesoById] Columna calificacionModo u otra columna nueva no encontrada; reintento sin calificacionModo. Ejecute migraciones Prisma.'
            );
            await redisDel(cacheKey).catch(() => {});
            proceso = await prisma.proceso.findUnique({
                where: { id: procesoId },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                select: PROCESO_BY_ID_SELECT_NO_RESIDUAL as any,
            });
            if (proceso) {
                proceso = { ...proceso, calificacionModo: 'ESTANDAR' };
            }
        }
        if (!proceso) return res.status(404).json({ error: 'Proceso not found' });

        // OPTIMIZADO: Cachear por 5 minutos
        await redisSet(cacheKey, proceso, 300);

        res.json(proceso);
    } catch (error: any) {
        console.error('[procesos/getProcesoById]', error?.message ?? error);
        res.status(500).json({
            error: 'Error fetching proceso',
            ...(process.env.NODE_ENV !== 'production' && {
                details: error?.message ?? String(error),
            }),
        });
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

        if (req.body.calificacionModo !== undefined) {
            const m = String(req.body.calificacionModo).trim().toUpperCase();
            if (m === 'ESTANDAR' || m === 'ESTRATEGICO') {
                (data as any).calificacionModo = m;
            }
        }

        let nuevoProceso;
        try {
            nuevoProceso = await prisma.proceso.create({
                data,
            });
        } catch (e: unknown) {
            if (!isPrismaSchemaColumnMissing(e) || (data as { calificacionModo?: string }).calificacionModo === undefined) {
                throw e;
            }
            const { calificacionModo: _r, ...dataSinResidual } = data as Record<string, unknown>;
            console.warn(
                '[procesos/createProceso] BD sin columna calificacionModo; proceso creado sin modo residual. Migre la BD.'
            );
            nuevoProceso = await prisma.proceso.create({
                data: dataSinResidual as typeof data,
            });
            (nuevoProceso as { calificacionModo?: string }).calificacionModo = 'ESTANDAR';
        }

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
        
        await redisDel('procesos:all');
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
    const { dofaItems, normatividades, contextos, contextoItems, participantesIds, id: bodyId, responsableId, areaId, ...rest } = req.body;
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

        // Guardar el responsableId anterior para comparar (fallback si BD sin columna calificacionModo)
        let procesoAnterior: { responsableId: number | null; calificacionModo: string | null } | null = null;
        try {
            procesoAnterior = await prisma.proceso.findUnique({
                where: { id },
                select: { responsableId: true, calificacionModo: true },
            });
        } catch (e: unknown) {
            if (!isPrismaSchemaColumnMissing(e)) throw e;
            const p = await prisma.proceso.findUnique({
                where: { id },
                select: { responsableId: true },
            });
            procesoAnterior = p ? { responsableId: p.responsableId, calificacionModo: 'ESTANDAR' } : null;
        }

        if (responsableId !== undefined) {
            updateData.responsableId = responsableId ? Number(responsableId) : null;
        }
        if (areaId) updateData.areaId = Number(areaId);

        // DOFA: solo 4 dimensiones (Fortalezas, Oportunidades, Debilidades, Amenazas). Estrategias FO/FA/DO/DA se borran.
        const TIPOS_DOFA_PERMITIDOS = ['FORTALEZA', 'OPORTUNIDAD', 'DEBILIDAD', 'AMENAZA'];
        if (dofaItems) {
            const itemsFiltrados = dofaItems.filter((item: any) =>
                TIPOS_DOFA_PERMITIDOS.includes(String(item.tipo).toUpperCase()));
            updateData.dofaItems = {
                deleteMany: {},
                create: itemsFiltrados.map((item: any) => ({
                    tipo: String(item.tipo).toUpperCase(),
                    descripcion: item.descripcion
                }))
            };
        }
        // Borrar siempre ítems de estrategias DOFA (FO, FA, DO, DA) si existieran en BD
        await prisma.dofaItem.deleteMany({
            where: { procesoId: id, tipo: { in: ['FO', 'FA', 'DO', 'DA'] } }
        }).catch(() => {});

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
                    comentarios: item.comentarios,
                    responsable: item.responsable
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

        if (contextoItems && Array.isArray(contextoItems)) {
            const validSignos = ['POSITIVO', 'NEGATIVO'];
            const validDofa = ['FORTALEZA', 'OPORTUNIDAD', 'DEBILIDAD', 'AMENAZA'];
            const dofaDimensionDesdeTipoSigno = (item: any): string | null => {
                const tipo = String(item.tipo ?? '')
                    .toUpperCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                const signo = String(item.signo ?? '').toUpperCase();
                if (signo !== 'POSITIVO' && signo !== 'NEGATIVO') return null;
                if (tipo.startsWith('INTERNO_')) return signo === 'POSITIVO' ? 'FORTALEZA' : 'DEBILIDAD';
                if (tipo.startsWith('EXTERNO_')) return signo === 'POSITIVO' ? 'OPORTUNIDAD' : 'AMENAZA';
                const internoSolo = new Set([
                    'FINANCIEROS', 'GENTE', 'PROCESOS', 'ACTIVOSFISICOS', 'CADENASUMINISTRO',
                    'INFORMACION', 'SISTEMAS', 'PROYECTOS', 'IMPUESTOS', 'GRUPOSINTERESINTERNOS'
                ]);
                const externoSolo = new Set([
                    'ECONOMICO', 'CULTURALSOCIAL', 'LEGALREGULATORIO', 'TECNOLOGICO', 'AMBIENTAL',
                    'GRUPOSINTERESEXTERNOS', 'POLITICO', 'MEGATENDENCIAS', 'OTROSFACTORES'
                ]);
                if (internoSolo.has(tipo)) return signo === 'POSITIVO' ? 'FORTALEZA' : 'DEBILIDAD';
                if (externoSolo.has(tipo)) return signo === 'POSITIVO' ? 'OPORTUNIDAD' : 'AMENAZA';
                return null;
            };
            const items = contextoItems
                .filter((item: any) => item && item.tipo && validSignos.includes(String(item.signo).toUpperCase()) && item.descripcion != null)
                .map((item: any) => {
                    // Nunca enviar 'id' en creates; que la BD lo genere
                    const payload: Record<string, unknown> = {
                        tipo: String(item.tipo),
                        signo: String(item.signo).toUpperCase(),
                        descripcion: String(item.descripcion)
                    };
                    // Solo exclusión explícita; null/undefined/filas viejas con default false en BD deben poder sincronizar
                    const incluirDofa = item.enviarADofa !== false;
                    const dim =
                        (item.dofaDimension && String(item.dofaDimension)) || dofaDimensionDesdeTipoSigno(item);
                    if (incluirDofa && dim && validDofa.includes(String(dim).toUpperCase())) {
                        payload.enviarADofa = true;
                        payload.dofaDimension = String(dim).toUpperCase();
                    }
                    return payload;
                });
            updateData.contextoItems = {
                deleteMany: {},
                create: items
            };
        }

        if (participantesIds) {
            updateData.participantes = {
                set: (participantesIds as string[]).map((id) => ({ id: Number(id) }))
            };
        }

        // Seguridad extra: nunca permitir que se intente actualizar el 'id' del proceso
        if ((updateData as any).id !== undefined) {
            delete (updateData as any).id;
        }

        if (updateData.calificacionModo !== undefined) {
            const m = String(updateData.calificacionModo).trim().toUpperCase();
            if (m === 'ESTANDAR' || m === 'ESTRATEGICO') {
                updateData.calificacionModo = m;
            } else {
                delete updateData.calificacionModo;
            }
        }

        const includeBlock = {
            dofaItems: true,
            normatividades: true,
            contextos: true,
            contextoItems: true,
            participantes: true,
        };

        let proceso: any;
        let calificacionModoPersistidoEnBd = true;

        try {
            proceso = await prisma.proceso.update({
                where: { id },
                data: updateData,
                include: includeBlock,
            });
        } catch (firstUp: unknown) {
            if (!isPrismaSchemaColumnMissing(firstUp)) throw firstUp;
            const { calificacionModo: _omitResidual, ...updateSinResidual } = updateData;
            if (updateData.calificacionModo !== undefined) {
                calificacionModoPersistidoEnBd = false;
                console.warn(
                    '[procesos/updateProceso] La BD no tiene columna calificacionModo; no se puede guardar modo estratégico hasta migrar. Ejecute: npx prisma migrate deploy'
                );
            }
            proceso = await prisma.proceso.update({
                where: { id },
                data: updateSinResidual,
                // select limita RETURNING: evita pedir columnas que no existen en PostgreSQL
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                select: PROCESO_UPDATE_SELECT_SIN_RESIDUAL as any,
            });
            proceso.calificacionModo = 'ESTANDAR';
        }

        // Invalidar caché de este proceso y del listado general para que el frontend vea los cambios al instante
        try {
            await redisDel(`proceso:${id}`);
            await redisDel('procesos:all');
        } catch (cacheErr) {
            // No romper la respuesta si falla Redis; solo loguear en consola
            console.warn('[procesos.updateProceso] No se pudo invalidar caché Redis:', cacheErr);
        }

        if (
            calificacionModoPersistidoEnBd &&
            updateData.calificacionModo !== undefined &&
            updateData.calificacionModo !== procesoAnterior?.calificacionModo
        ) {
            const riesgosProceso = await prisma.riesgo.findMany({
                where: { procesoId: id },
                select: { id: true },
            });
            for (const r of riesgosProceso) {
                await recalcularResidualPorRiesgo(r.id).catch((e) =>
                    console.warn('[procesos.updateProceso] recalcularResidualPorRiesgo:', e)
                );
            }
        }

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

        await redisDel('procesos:all');
        await redisDel(`proceso:${id}`);
        if (dofaItems) await redisDel(`dofa:proceso:${id}`);

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
        await redisDel('procesos:all');
        await redisDel(`proceso:${id}`);
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
