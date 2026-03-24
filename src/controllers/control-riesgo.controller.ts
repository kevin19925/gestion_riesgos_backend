import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * CONTROL RIESGO CONTROLLER
 * Gestiona controles asociados a causas de riesgo (tabla normalizada ControlRiesgo)
 */

// Crear control para una causa
export const createControlRiesgo = async (req: Request, res: Response) => {
  try {
    const { causaRiesgoId } = req.params;
    const {
      descripcion,
      tipoControl,
      responsable,
      aplicabilidad,
      cobertura,
      facilidadUso,
      segregacion,
      naturaleza,
      desviaciones,
      puntajeControl,
      evaluacionPreliminar,
      evaluacionDefinitiva,
      estandarizacionPorcentajeMitigacion,
      disminuyeFrecuenciaImpactoAmbas,
      descripcionControl,
      recomendacion,
      tipoMitigacion,
      estadoAmbos,
      planAccionVinculadoId
    } = req.body;

    // Validar que la causa existe
    const causa = await prisma.causaRiesgo.findUnique({
      where: { id: Number(causaRiesgoId) }
    });

    if (!causa) {
      return res.status(404).json({ error: 'Causa de riesgo no encontrada' });
    }

    // Validar que el plan de acción existe si se proporciona
    if (planAccionVinculadoId) {
      const plan = await prisma.planAccion.findUnique({
        where: { id: Number(planAccionVinculadoId) }
      });

      if (!plan) {
        return res.status(404).json({ error: 'Plan de acción no encontrado' });
      }
    }

    const control = await prisma.controlRiesgo.create({
      data: {
        causaRiesgoId: Number(causaRiesgoId),
        descripcion: descripcion || '',
        tipoControl: tipoControl || 'PREVENTIVO',
        responsable,
        aplicabilidad: aplicabilidad ? Number(aplicabilidad) : null,
        cobertura: cobertura ? Number(cobertura) : null,
        facilidadUso: facilidadUso ? Number(facilidadUso) : null,
        segregacion: segregacion ? Number(segregacion) : null,
        naturaleza: naturaleza ? Number(naturaleza) : null,
        desviaciones: desviaciones ? Number(desviaciones) : null,
        puntajeControl: puntajeControl ? Number(puntajeControl) : null,
        evaluacionPreliminar,
        evaluacionDefinitiva,
        estandarizacionPorcentajeMitigacion: estandarizacionPorcentajeMitigacion ? Number(estandarizacionPorcentajeMitigacion) : null,
        disminuyeFrecuenciaImpactoAmbas,
        descripcionControl,
        recomendacion,
        tipoMitigacion,
        estadoAmbos,
        planAccionVinculadoId: planAccionVinculadoId ? Number(planAccionVinculadoId) : null,
        recalculadoEn: new Date()
      }
    });

    res.status(201).json(control);
  } catch (error) {
    console.error('Error creating control:', error);
    res.status(500).json({ 
      error: 'Error al crear el control',
      details: (error as Error).message 
    });
  }
};

// Actualizar control existente
export const updateControlRiesgo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      descripcion,
      tipoControl,
      responsable,
      aplicabilidad,
      cobertura,
      facilidadUso,
      segregacion,
      naturaleza,
      desviaciones,
      puntajeControl,
      evaluacionPreliminar,
      evaluacionDefinitiva,
      estandarizacionPorcentajeMitigacion,
      disminuyeFrecuenciaImpactoAmbas,
      descripcionControl,
      recomendacion,
      tipoMitigacion,
      estadoAmbos,
      planAccionVinculadoId
    } = req.body;

    // Verificar que el control existe
    const controlExistente = await prisma.controlRiesgo.findUnique({
      where: { id: Number(id) }
    });

    if (!controlExistente) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    // Validar que el plan de acción existe si se proporciona
    if (planAccionVinculadoId) {
      const plan = await prisma.planAccion.findUnique({
        where: { id: Number(planAccionVinculadoId) }
      });

      if (!plan) {
        return res.status(404).json({ error: 'Plan de acción no encontrado' });
      }
    }

    const control = await prisma.controlRiesgo.update({
      where: { id: Number(id) },
      data: {
        ...(descripcion !== undefined && { descripcion }),
        ...(tipoControl !== undefined && { tipoControl }),
        ...(responsable !== undefined && { responsable }),
        ...(aplicabilidad !== undefined && { aplicabilidad: Number(aplicabilidad) }),
        ...(cobertura !== undefined && { cobertura: Number(cobertura) }),
        ...(facilidadUso !== undefined && { facilidadUso: Number(facilidadUso) }),
        ...(segregacion !== undefined && { segregacion: Number(segregacion) }),
        ...(naturaleza !== undefined && { naturaleza: Number(naturaleza) }),
        ...(desviaciones !== undefined && { desviaciones: Number(desviaciones) }),
        ...(puntajeControl !== undefined && { puntajeControl: Number(puntajeControl) }),
        ...(evaluacionPreliminar !== undefined && { evaluacionPreliminar }),
        ...(evaluacionDefinitiva !== undefined && { evaluacionDefinitiva }),
        ...(estandarizacionPorcentajeMitigacion !== undefined && { 
          estandarizacionPorcentajeMitigacion: Number(estandarizacionPorcentajeMitigacion) 
        }),
        ...(disminuyeFrecuenciaImpactoAmbas !== undefined && { disminuyeFrecuenciaImpactoAmbas }),
        ...(descripcionControl !== undefined && { descripcionControl }),
        ...(recomendacion !== undefined && { recomendacion }),
        ...(tipoMitigacion !== undefined && { tipoMitigacion }),
        ...(estadoAmbos !== undefined && { estadoAmbos }),
        ...(planAccionVinculadoId !== undefined && { 
          planAccionVinculadoId: planAccionVinculadoId ? Number(planAccionVinculadoId) : null 
        }),
        recalculadoEn: new Date()
      }
    });

    res.json(control);
  } catch (error) {
    console.error('Error updating control:', error);
    if ((error as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'Control no encontrado' });
    }
    res.status(500).json({ 
      error: 'Error al actualizar el control',
      details: (error as Error).message 
    });
  }
};

// Eliminar control
export const deleteControlRiesgo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar que el control existe
    const controlExistente = await prisma.controlRiesgo.findUnique({
      where: { id: Number(id) }
    });

    if (!controlExistente) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    await prisma.controlRiesgo.delete({
      where: { id: Number(id) }
    });

    res.json({ message: 'Control eliminado exitosamente' });
  } catch (error) {
    console.error('Error deleting control:', error);
    if ((error as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'Control no encontrado' });
    }
    if ((error as any)?.code === 'P2003') {
      return res.status(400).json({ 
        error: 'No se puede eliminar el control porque tiene registros asociados' 
      });
    }
    res.status(500).json({ 
      error: 'Error al eliminar el control',
      details: (error as Error).message 
    });
  }
};

// Obtener controles por causa
export const getControlesByCausa = async (req: Request, res: Response) => {
  try {
    const { causaRiesgoId } = req.params;

    const controles = await prisma.controlRiesgo.findMany({
      where: { causaRiesgoId: Number(causaRiesgoId) },
      include: {
        planAccionVinculado: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            estado: true,
            responsable: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    res.json(controles);
  } catch (error) {
    console.error('Error fetching controles:', error);
    res.status(500).json({ 
      error: 'Error al obtener controles',
      details: (error as Error).message 
    });
  }
};

// Obtener control por ID
export const getControlById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const control = await prisma.controlRiesgo.findUnique({
      where: { id: Number(id) },
      include: {
        causaRiesgo: {
          include: {
            riesgo: {
              select: {
                id: true,
                numeroIdentificacion: true,
                descripcion: true
              }
            }
          }
        },
        planAccionVinculado: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            estado: true,
            responsable: true,
            fechaInicio: true,
            fechaFin: true
          }
        }
      }
    });

    if (!control) {
      return res.status(404).json({ error: 'Control no encontrado' });
    }

    res.json(control);
  } catch (error) {
    console.error('Error fetching control:', error);
    res.status(500).json({ 
      error: 'Error al obtener el control',
      details: (error as Error).message 
    });
  }
};
