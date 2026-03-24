import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * Obtener riesgos en zona crítica
 * GET /riesgos/criticos
 * 
 * Retorna los riesgos que están en zona crítica (rojo con exclamación)
 * Zona crítica: probabilidad * impacto >= 15
 */
export const getRiesgosCriticos = async (req: Request, res: Response) => {
    try {
        // Obtener riesgos con evaluación
        const riesgos = await prisma.riesgo.findMany({
            select: {
                id: true,
                numeroIdentificacion: true,
                descripcion: true,
                proceso: {
                    select: {
                        id: true,
                        nombre: true,
                        sigla: true
                    }
                },
                evaluacion: {
                    select: {
                        probabilidad: true,
                        impactoGlobal: true,
                        probabilidadResidual: true,
                        impactoResidual: true,
                    }
                }
            }
        });

        const riesgosCriticos: any[] = [];

        riesgos.forEach(riesgo => {
            if (!riesgo.evaluacion) return;

            const probInherente = Number(riesgo.evaluacion.probabilidad) || 0;
            const impInherente = Number(riesgo.evaluacion.impactoGlobal) || 0;
            const valorInherente = probInherente * impInherente;

            const probResidual = Number(riesgo.evaluacion.probabilidadResidual) || probInherente;
            const impResidual = Number(riesgo.evaluacion.impactoResidual) || impInherente;
            const valorResidual = probResidual * impResidual;

            // Inherente crítico
            if (valorInherente >= 15) {
                riesgosCriticos.push({
                    id: riesgo.id,
                    codigo: riesgo.numeroIdentificacion,
                    descripcion: riesgo.descripcion,
                    proceso: riesgo.proceso?.nombre || 'Sin proceso',
                    procesoSigla: riesgo.proceso?.sigla || '',
                    probabilidad: probInherente,
                    impacto: impInherente,
                    valorRiesgo: valorInherente,
                    tipo: 'inherente'
                });
            }

            // Residual crítico
            if (valorResidual >= 15) {
                riesgosCriticos.push({
                    id: riesgo.id,
                    codigo: riesgo.numeroIdentificacion,
                    descripcion: riesgo.descripcion,
                    proceso: riesgo.proceso?.nombre || 'Sin proceso',
                    procesoSigla: riesgo.proceso?.sigla || '',
                    probabilidad: probResidual,
                    impacto: impResidual,
                    valorRiesgo: valorResidual,
                    tipo: 'residual'
                });
            }
        });

        // Separar por tipo
        const inherentes = riesgosCriticos.filter(r => r.tipo === 'inherente');
        const residuales = riesgosCriticos.filter(r => r.tipo === 'residual');

        res.json({
            total: riesgosCriticos.length,
            inherentes: {
                cantidad: inherentes.length,
                riesgos: inherentes
            },
            residuales: {
                cantidad: residuales.length,
                riesgos: residuales
            }
        });
    } catch (error) {
        console.error('[riesgos-criticos/getRiesgosCriticos]', error);
        res.status(500).json({ error: 'Error al obtener riesgos críticos' });
    }
};

/**
 * Obtener conteo de riesgos críticos
 * GET /riesgos/criticos/conteo
 * 
 * Retorna solo el conteo de riesgos críticos para notificaciones
 */
export const getConteoCriticos = async (req: Request, res: Response) => {
    try {
        const riesgos = await prisma.riesgo.findMany({
            select: {
                evaluacion: {
                    select: {
                        probabilidad: true,
                        impactoGlobal: true,
                        probabilidadResidual: true,
                        impactoResidual: true,
                    }
                }
            }
        });

        let inherentes = 0;
        let residuales = 0;

        riesgos.forEach(riesgo => {
            if (!riesgo.evaluacion) return;

            const probInherente = Number(riesgo.evaluacion.probabilidad) || 0;
            const impInherente = Number(riesgo.evaluacion.impactoGlobal) || 0;
            const valorInherente = probInherente * impInherente;

            const probResidual = Number(riesgo.evaluacion.probabilidadResidual) || probInherente;
            const impResidual = Number(riesgo.evaluacion.impactoResidual) || impInherente;
            const valorResidual = probResidual * impResidual;

            if (valorInherente >= 15) inherentes++;
            if (valorResidual >= 15) residuales++;
        });

        res.json({
            total: inherentes + residuales,
            inherentes,
            residuales
        });
    } catch (error) {
        console.error('[riesgos-criticos/getConteoCriticos]', error);
        res.status(500).json({ error: 'Error al obtener conteo de riesgos críticos' });
    }
};
