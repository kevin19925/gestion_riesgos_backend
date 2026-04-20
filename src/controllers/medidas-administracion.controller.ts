import { Request, Response } from 'express';
import prisma from '../prisma';
import { calcularEvaluacionMedida } from '../services/medidas-administracion.service';

/**
 * GET /api/medidas-administracion?causaRiesgoId=X
 * Obtiene todas las medidas de administración de una causa
 */
export async function obtenerMedidasPorCausa(req: Request, res: Response) {
  const { causaRiesgoId } = req.query;

  if (!causaRiesgoId) {
    return res.status(400).json({ error: 'causaRiesgoId es requerido' });
  }

  try {
    const medidas = await prisma.medidaAdministracion.findMany({
      where: { causaRiesgoId: Number(causaRiesgoId) },
      orderBy: { fechaCreacion: 'desc' },
    });
    return res.json(medidas);
  } catch (error: any) {
    console.error('[MedidasAdmin] Error al obtener medidas:', error);
    return res.status(500).json({ error: 'Error al obtener medidas de administración', details: error?.message });
  }
}

/**
 * POST /api/medidas-administracion
 * Crea una nueva medida de administración con cálculo automático de evaluación
 */
export async function crearMedida(req: Request, res: Response) {
  const {
    causaRiesgoId,
    descripcion,
    afecta,
    presupuesto,
    stakeholders,
    entrenamiento,
    politicas,
    monitoreo,
    responsable,
  } = req.body;

  if (!causaRiesgoId || !descripcion) {
    return res.status(400).json({ error: 'causaRiesgoId y descripcion son requeridos' });
  }

  try {
    // Calcula la evaluación automáticamente
    const resultado = calcularEvaluacionMedida({
      presupuesto,
      stakeholders,
      entrenamiento,
      politicas,
      monitoreo,
    });

    // Obtener el usuario autenticado si existe en el request
    const usuarioId = (req as any).user?.id ?? null;

    const medida = await prisma.medidaAdministracion.create({
      data: {
        causaRiesgoId: Number(causaRiesgoId),
        descripcion,
        afecta: afecta ?? null,
        presupuesto: presupuesto ?? null,
        puntajePresupuesto: resultado.puntajePresupuesto,
        stakeholders: stakeholders ?? null,
        puntajeStakeholders: resultado.puntajeStakeholders,
        entrenamiento: entrenamiento ?? null,
        puntajeEntrenamiento: resultado.puntajeEntrenamiento,
        politicas: politicas ?? null,
        puntajePoliticas: resultado.puntajePoliticas,
        monitoreo: monitoreo ?? null,
        puntajeMonitoreo: resultado.puntajeMonitoreo,
        puntajeTotal: resultado.puntajeTotal,
        evaluacion: resultado.evaluacion,
        factorReduccion: resultado.factorReduccion,
        responsable: responsable ?? null,
        creadoPor: usuarioId,
        actualizadoPor: usuarioId,
      },
    });

    return res.status(201).json(medida);
  } catch (error: any) {
    console.error('[MedidasAdmin] Error al crear medida:', error);
    return res.status(500).json({ error: 'Error al crear medida de administración', details: error?.message });
  }
}

/**
 * PUT /api/medidas-administracion/:id
 * Actualiza una medida existente y recalcula la evaluación
 */
export async function actualizarMedida(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const {
    descripcion,
    afecta,
    presupuesto,
    stakeholders,
    entrenamiento,
    politicas,
    monitoreo,
    responsable,
  } = req.body;

  try {
    // Verificar que la medida existe
    const medidaExistente = await prisma.medidaAdministracion.findUnique({ where: { id } });
    if (!medidaExistente) {
      return res.status(404).json({ error: 'Medida de administración no encontrada' });
    }

    // Calcular nueva evaluación con los datos actualizados (usa los existentes si no se pasan)
    const datos = {
      presupuesto: presupuesto !== undefined ? presupuesto : medidaExistente.presupuesto,
      stakeholders: stakeholders !== undefined ? stakeholders : medidaExistente.stakeholders,
      entrenamiento: entrenamiento !== undefined ? entrenamiento : medidaExistente.entrenamiento,
      politicas: politicas !== undefined ? politicas : medidaExistente.politicas,
      monitoreo: monitoreo !== undefined ? monitoreo : medidaExistente.monitoreo,
    };

    const resultado = calcularEvaluacionMedida(datos);
    const usuarioId = (req as any).user?.id ?? null;

    const medidaActualizada = await prisma.medidaAdministracion.update({
      where: { id },
      data: {
        ...(descripcion !== undefined && { descripcion }),
        ...(afecta !== undefined && { afecta }),
        presupuesto: datos.presupuesto,
        puntajePresupuesto: resultado.puntajePresupuesto,
        stakeholders: datos.stakeholders,
        puntajeStakeholders: resultado.puntajeStakeholders,
        entrenamiento: datos.entrenamiento,
        puntajeEntrenamiento: resultado.puntajeEntrenamiento,
        politicas: datos.politicas,
        puntajePoliticas: resultado.puntajePoliticas,
        monitoreo: datos.monitoreo,
        puntajeMonitoreo: resultado.puntajeMonitoreo,
        puntajeTotal: resultado.puntajeTotal,
        evaluacion: resultado.evaluacion,
        factorReduccion: resultado.factorReduccion,
        ...(responsable !== undefined && { responsable }),
        actualizadoPor: usuarioId,
      },
    });

    return res.json(medidaActualizada);
  } catch (error: any) {
    console.error('[MedidasAdmin] Error al actualizar medida:', error);
    return res.status(500).json({ error: 'Error al actualizar medida de administración', details: error?.message });
  }
}

/**
 * DELETE /api/medidas-administracion/:id
 * Elimina una medida de administración
 */
export async function eliminarMedida(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    await prisma.medidaAdministracion.delete({ where: { id } });
    return res.json({ message: 'Medida de administración eliminada correctamente' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Medida no encontrada o ya eliminada' });
    }
    console.error('[MedidasAdmin] Error al eliminar medida:', error);
    return res.status(500).json({ error: 'Error al eliminar medida de administración', details: error?.message });
  }
}
