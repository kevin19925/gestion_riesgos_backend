/**
 * Controlador de Configuración Residual
 */

import { Request, Response } from 'express';
import prisma from '../prisma';
import { 
  getConfiguracionActiva, 
  invalidarCacheConfiguracion 
} from '../services/configuracionResidual.service';
import { recalcularTodosLosRiesgosResiduales } from '../services/recalculoResidual.service';

/**
 * GET /api/configuracion-residual
 * Obtiene la configuración residual activa
 */
export const getConfiguracion = async (req: Request, res: Response) => {
  try {
    const config = await getConfiguracionActiva();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Error al obtener configuración',
      message: error.message 
    });
  }
};

/**
 * PUT /api/configuracion-residual/:id
 * Actualiza la configuración residual
 */
export const updateConfiguracion = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  
  try {
    const {
      nombre,
      descripcion,
      activa,
      pesosCriterios,
      rangosEvaluacion,
      tablaMitigacion,
      opcionesCriterios,
      rangosNivelRiesgo
    } = req.body;

    // Validar suma de pesos = 1.0 (100%)
    if (pesosCriterios) {
      const sumaPesos = pesosCriterios.reduce((sum: number, p: any) => sum + p.peso, 0);
      if (Math.abs(sumaPesos - 1.0) > 0.01) {
        return res.status(400).json({
          error: 'La suma de los pesos debe ser 100%',
          sumaActual: (sumaPesos * 100).toFixed(2) + '%'
        });
      }
    }

    // Usar transacción para actualizar todo
    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar datos básicos
      const config = await tx.configuracionResidual.update({
        where: { id },
        data: {
          nombre,
          descripcion,
          activa
        }
      });

      // Actualizar pesos de criterios
      if (pesosCriterios) {
        // Eliminar existentes
        await tx.pesoCriterioResidual.deleteMany({ where: { configId: id } });
        // Crear nuevos
        await tx.pesoCriterioResidual.createMany({
          data: pesosCriterios.map((p: any) => ({
            configId: id,
            criterio: p.criterio,
            peso: p.peso,
            orden: p.orden,
            activo: p.activo
          }))
        });
      }

      // Actualizar rangos de evaluación
      if (rangosEvaluacion) {
        await tx.rangoEvaluacionResidual.deleteMany({ where: { configId: id } });
        await tx.rangoEvaluacionResidual.createMany({
          data: rangosEvaluacion.map((r: any) => ({
            configId: id,
            nivelNombre: r.nivelNombre,
            valorMinimo: r.valorMinimo,
            valorMaximo: r.valorMaximo,
            incluirMinimo: r.incluirMinimo,
            incluirMaximo: r.incluirMaximo,
            orden: r.orden,
            activo: r.activo
          }))
        });
      }

      // Actualizar tabla de mitigación
      if (tablaMitigacion) {
        await tx.tablaMitigacionResidual.deleteMany({ where: { configId: id } });
        await tx.tablaMitigacionResidual.createMany({
          data: tablaMitigacion.map((t: any) => ({
            configId: id,
            evaluacion: t.evaluacion,
            porcentaje: t.porcentaje,
            orden: t.orden,
            activo: t.activo
          }))
        });
      }

      // Actualizar opciones de criterios
      if (opcionesCriterios) {
        await tx.opcionCriterioResidual.deleteMany({ where: { configId: id } });
        await tx.opcionCriterioResidual.createMany({
          data: opcionesCriterios.map((o: any) => ({
            configId: id,
            criterio: o.criterio,
            label: o.label,
            valor: o.valor,
            orden: o.orden,
            activo: o.activo
          }))
        });
      }

      // Actualizar rangos de nivel de riesgo residual
      if (rangosNivelRiesgo) {
        await tx.rangoNivelRiesgoResidual.deleteMany({ where: { configId: id } });
        await tx.rangoNivelRiesgoResidual.createMany({
          data: rangosNivelRiesgo.map((r: any) => ({
            configId: id,
            nivelNombre: r.nivelNombre,
            valorMinimo: r.valorMinimo,
            valorMaximo: r.valorMaximo,
            incluirMinimo: r.incluirMinimo,
            incluirMaximo: r.incluirMaximo,
            orden: r.orden,
            activo: r.activo
          }))
        });
      }

      return config;
    });

    // Invalidar caché
    invalidarCacheConfiguracion();
    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      config: updated
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Error al actualizar configuración',
      message: error.message
    });
  }
};

/**
 * POST /api/configuracion-residual/recalcular
 * Recalcula todos los riesgos residuales
 * 
 * Query params:
 * - preview=true: Solo simula sin guardar cambios
 * 
 * Body:
 * - confirmacion: true (requerido en producción)
 */
export const recalcularRiesgos = async (req: Request, res: Response) => {
  try {
    const preview = req.query.preview === 'true';
    const { confirmacion } = req.body;

    // Validar confirmación en producción
    if (process.env.NODE_ENV === 'production' && !preview && !confirmacion) {
      return res.status(403).json({
        error: 'Requiere confirmación explícita en producción',
        message: 'Envía { confirmacion: true } en el body para confirmar'
      });
    }

    const resultado = await recalcularTodosLosRiesgosResiduales(preview);

    res.json({
      success: true,
      preview,
      resultado
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Error al recalcular riesgos',
      message: error.message
    });
  }
};
