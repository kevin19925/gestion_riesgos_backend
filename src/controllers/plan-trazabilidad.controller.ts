import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * PLAN TRAZABILIDAD CONTROLLER
 * Gestiona la trazabilidad y evolución de planes de acción en CausaRiesgo.gestion
 */

/**
 * PUT /api/causas/:id/plan/estado
 * Cambia el estado de un plan de acción
 * REFACTORIZADO: Trabaja con tabla PlanAccion y HistorialEstadoPlan
 */
export const cambiarEstadoPlan = async (req: Request, res: Response) => {
  try {
    const causaId = Number(req.params.id);
    const { estado, observacion } = req.body;
    const user = (req as any).user;

    // Validar estado
    const estadosValidos = ['pendiente', 'en_revision', 'revisado', 'PENDIENTE', 'EN_REVISION', 'REVISADO', 'EN_PROGRESO', 'COMPLETADO'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        error: 'Estado inválido',
        estadosValidos
      });
    }

    // Obtener causa actual
    const causa = await prisma.causaRiesgo.findUnique({
      where: { id: causaId },
      include: { riesgo: true }
    });

    if (!causa) {
      return res.status(404).json({ error: 'Causa no encontrada' });
    }

    // Buscar el plan asociado
    const plan = await prisma.planAccion.findFirst({
      where: { causaRiesgoId: causaId }
    });

    if (!plan) {
      return res.status(400).json({
        error: 'Esta causa no tiene un plan de acción asociado'
      });
    }

    const estadoAnterior = plan.estado;
    const estadoNormalizado = estado.toLowerCase();
    const estadoAnteriorNormalizado = estadoAnterior.toLowerCase();

    // VALIDACIONES DE ROLES PARA CAMBIO DE ESTADO
    const userRole = user?.role?.toLowerCase() || '';

    // Validación 1: Solo SUPERVISOR puede cambiar de "pendiente" a "en_revision" (revisado)
    if (estadoAnteriorNormalizado === 'pendiente' && estadoNormalizado === 'en_revision') {
      if (userRole !== 'supervisor') {
        return res.status(403).json({
          error: 'Permiso denegado',
          message: 'Solo el Supervisor puede cambiar el estado de Pendiente a Revisado'
        });
      }
    }

    // Validación 2: Solo GERENTE puede cambiar de "en_revision" (revisado) a "revisado" (aprobado)
    if (estadoAnteriorNormalizado === 'en_revision' && estadoNormalizado === 'revisado') {
      if (userRole !== 'gerente' && userRole !== 'gerente_general' && userRole !== 'manager') {
        return res.status(403).json({
          error: 'Permiso denegado',
          message: 'Solo el Gerente puede cambiar el estado de Revisado a Aprobado'
        });
      }
    }

    // Validación 3: GERENTE NO puede volver a "pendiente" desde "en_revision"
    if (estadoAnteriorNormalizado === 'en_revision' && estadoNormalizado === 'pendiente') {
      if (userRole === 'gerente' || userRole === 'gerente_general' || userRole === 'manager') {
        return res.status(403).json({
          error: 'Permiso denegado',
          message: 'El Gerente no puede devolver planes a estado Pendiente'
        });
      }
    }

    // Actualizar estado del plan
    const planActualizado = await prisma.planAccion.update({
      where: { id: plan.id },
      data: { estado }
    });

    // Crear entrada en historial de estados
    await prisma.historialEstadoPlan.create({
      data: {
        causaRiesgoId: causaId,
        estado,
        responsable: (req as any).user?.nombre || 'Sistema',
        detalle: observacion || '',
        fechaEstado: new Date(),
        origenMigracion: false
      }
    });

    // Log para debugging
    console.log('✅ Estado actualizado:', {
      causaId,
      planId: plan.id,
      estadoAnterior,
      estadoNuevo: estado
    });

    // Registrar en historial de eventos
    await prisma.historialEvento.create({
      data: {
        usuarioId: user?.userId || user?.id,
        usuarioEmail: user?.email,
        usuarioNombre: user?.nombre,
        procesoId: causa.riesgo?.procesoId,
        modulo: 'planes',
        pagina: 'plan-accion',
        seccion: 'estado',
        entidadTipo: 'PlanAccion',
        entidadId: plan.id,
        accion: 'UPDATE',
        descripcion: `Cambio de estado del plan: ${estadoAnterior} → ${estado}`,
        valorAnterior: estadoAnterior,
        valorNuevo: estado
      }
    });

    res.json({
      success: true,
      plan: planActualizado,
      estadoAnterior,
      estadoNuevo: estado
    });
  } catch (error) {
    console.error('Error al cambiar estado del plan:', error);
    res.status(500).json({ error: 'Error al cambiar estado del plan' });
  }
};

/**
 * POST /api/causas/:id/plan/convertir-a-control
 * Convierte un plan de acción exitoso en un control permanente
 * REFACTORIZADO: Trabaja con tabla PlanAccion normalizada
 */
export const convertirPlanAControl = async (req: Request, res: Response) => {
  try {
    const causaId = Number(req.params.id);
    const { tipoControl, observaciones } = req.body;

    // Validar tipo de control
    const tiposValidos = ['prevención', 'detección', 'corrección'];
    if (!tipoControl || !tiposValidos.includes(tipoControl)) {
      return res.status(400).json({
        error: 'Tipo de control inválido',
        tiposValidos
      });
    }

    // Obtener causa actual
    const causa = await prisma.causaRiesgo.findUnique({
      where: { id: causaId },
      include: { riesgo: true }
    });

    if (!causa) {
      return res.status(404).json({ error: 'Causa no encontrada' });
    }

    // Buscar el plan asociado
    const plan = await prisma.planAccion.findFirst({
      where: { causaRiesgoId: causaId }
    });

    if (!plan) {
      return res.status(400).json({
        error: 'Esta causa no tiene un plan de acción asociado'
      });
    }

    // Verificar que el plan está completado
    if (plan.estado !== 'COMPLETADO' && plan.estado !== 'completado' && plan.estado !== 'revisado') {
      return res.status(400).json({
        error: 'Solo se pueden convertir planes completados',
        estadoActual: plan.estado
      });
    }

    // Verificar que no fue convertido previamente
    // Buscar en el historial si ya existe una conversión
    const conversionPrevia = await prisma.historialEstadoPlan.findFirst({
      where: { 
        causaRiesgoId: causaId,
        estado: 'CONVERTIDO_A_CONTROL'
      }
    });

    if (conversionPrevia) {
      return res.status(400).json({
        error: 'Este plan ya fue convertido a control previamente'
      });
    }

    // Verificar que tiene riesgo asociado
    if (!causa.riesgoId) {
      return res.status(400).json({
        error: 'La causa debe tener un riesgo asociado para crear un control'
      });
    }

    // Crear el control en ControlRiesgo
    const nuevoControl = await prisma.controlRiesgo.create({
      data: {
        causaRiesgoId: causaId,
        descripcion: plan.descripcion || causa.descripcion,
        tipoControl,
        responsable: plan.responsable || '',
        descripcionControl: `Control derivado del plan: ${plan.descripcion}`,
        recomendacion: observaciones || '',
        // Valores por defecto para campos requeridos
        aplicabilidad: 3,
        cobertura: 3,
        facilidadUso: 3,
        segregacion: 3,
        naturaleza: 1, // Manual
        desviaciones: 0,
        puntajeControl: 75, // 75% por defecto para controles derivados de planes exitosos
        evaluacionPreliminar: 'Efectivo',
        evaluacionDefinitiva: 'Por evaluar'
      }
    });

    // Actualizar el plan para marcar que fue convertido
    await prisma.planAccion.update({
      where: { id: plan.id },
      data: {
        observaciones: `${plan.observaciones || ''}\n[Convertido a control ID: ${nuevoControl.id}]`.trim()
      }
    });

    // Crear entrada en historial
    await prisma.historialEstadoPlan.create({
      data: {
        causaRiesgoId: causaId,
        estado: 'CONVERTIDO_A_CONTROL',
        responsable: (req as any).user?.nombre || 'Sistema',
        detalle: `Plan convertido a control (ID: ${nuevoControl.id})`,
        decision: observaciones || '',
        fechaEstado: new Date(),
        origenMigracion: false
      }
    });

    // Registrar en historial de eventos
    const user = (req as any).user;
    await prisma.historialEvento.create({
      data: {
        usuarioId: user?.userId || user?.id,
        usuarioEmail: user?.email,
        usuarioNombre: user?.nombre,
        procesoId: causa.riesgo?.procesoId,
        modulo: 'planes',
        pagina: 'plan-accion',
        seccion: 'conversion',
        entidadTipo: 'PlanAccion',
        entidadId: plan.id,
        accion: 'CREATE',
        descripcion: `Plan convertido a control (ID: ${nuevoControl.id})`,
        valoresNuevos: {
          controlId: nuevoControl.id,
          tipoControl,
          observaciones
        }
      }
    });

    res.status(201).json({
      success: true,
      control: nuevoControl,
      plan,
      message: 'Plan convertido exitosamente a control'
    });
  } catch (error) {
    console.error('Error al convertir plan a control:', error);
    res.status(500).json({ error: 'Error al convertir plan a control' });
  }
};

/**
 * GET /api/causas/:id/plan/trazabilidad
 * Obtiene el historial completo de trazabilidad de un plan
 * REFACTORIZADO: Trabaja con tablas PlanAccion y HistorialEstadoPlan
 */
export const obtenerTrazabilidadPlan = async (req: Request, res: Response) => {
  try {
    const causaId = Number(req.params.id);

    // Obtener causa con todas las relaciones
    const causa = await prisma.causaRiesgo.findUnique({
      where: { id: causaId },
      include: {
        riesgo: {
          include: {
            proceso: true
          }
        }
      }
    });

    if (!causa) {
      return res.status(404).json({ error: 'Causa no encontrada' });
    }

    // Obtener el plan asociado
    const plan = await prisma.planAccion.findFirst({
      where: { causaRiesgoId: causaId },
      orderBy: { createdAt: 'desc' }
    });

    if (!plan) {
      return res.status(404).json({ 
        error: 'Esta causa no tiene un plan de acción asociado' 
      });
    }

    // Obtener historial de estados del plan
    const historialEstados = await prisma.historialEstadoPlan.findMany({
      where: { causaRiesgoId: causaId },
      orderBy: { fechaEstado: 'desc' }
    });

    // Obtener control derivado si existe
    // Buscar en el historial si hay una conversión
    const conversionHistorial = await prisma.historialEstadoPlan.findFirst({
      where: { 
        causaRiesgoId: causaId,
        estado: 'CONVERTIDO_A_CONTROL'
      },
      orderBy: { fechaEstado: 'desc' }
    });

    let controlDerivado = null;
    if (conversionHistorial) {
      // Buscar el control más reciente de esta causa
      controlDerivado = await prisma.controlRiesgo.findFirst({
        where: { causaRiesgoId: causaId },
        orderBy: { id: 'desc' }
      });
    }

    // Obtener historial de eventos relacionados
    const historialEventos = await prisma.historialEvento.findMany({
      where: {
        OR: [
          {
            entidadTipo: 'CausaRiesgo',
            entidadId: causaId
          },
          {
            entidadTipo: 'PlanAccion',
            entidadId: plan.id
          }
        ]
      },
      orderBy: { fecha: 'desc' },
      take: 50
    });

    // Construir respuesta de trazabilidad
    const trazabilidad = {
      causa: {
        id: causa.id,
        descripcion: causa.descripcion,
        riesgo: {
          id: causa.riesgo?.id,
          numeroIdentificacion: (causa.riesgo as any)?.numeroIdentificacion,
          descripcion: causa.riesgo?.descripcion,
          proceso: causa.riesgo?.proceso?.nombre
        }
      },
      plan: {
        id: plan.id,
        descripcion: plan.descripcion,
        responsable: plan.responsable,
        fechaInicio: plan.fechaInicio,
        fechaFin: plan.fechaFin,
        fechaProgramada: plan.fechaProgramada,
        estado: plan.estado,
        porcentajeAvance: plan.porcentajeAvance,
        observaciones: plan.observaciones,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      },
      historialEstados: historialEstados.map(h => ({
        id: h.id,
        estado: h.estado,
        responsable: h.responsable,
        detalle: h.detalle,
        decision: h.decision,
        porcentajeAvance: h.porcentajeAvance,
        fechaEstado: h.fechaEstado,
        registradoEn: h.registradoEn
      })),
      controlDerivado: controlDerivado ? {
        id: controlDerivado.id,
        descripcion: controlDerivado.descripcion,
        tipoControl: controlDerivado.tipoControl,
        puntajeControl: controlDerivado.puntajeControl,
        evaluacionDefinitiva: controlDerivado.evaluacionDefinitiva,
        createdAt: controlDerivado.createdAt
      } : null,
      eventos: historialEventos.map(e => ({
        fecha: e.fecha,
        usuario: e.usuarioNombre,
        accion: e.accion,
        descripcion: e.descripcion,
        valorAnterior: e.valorAnterior,
        valorNuevo: e.valorNuevo
      }))
    };

    res.json(trazabilidad);
  } catch (error) {
    console.error('Error al obtener trazabilidad:', error);
    res.status(500).json({ error: 'Error al obtener trazabilidad del plan' });
  }
};

/**
 * GET /api/planes-accion/alertas-vencimiento
 * Obtiene alertas de vencimiento para el usuario actual
 * REFACTORIZADO: Trabaja con tabla PlanAccion normalizada
 */
export const obtenerAlertasVencimiento = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const usuarioId = user?.userId || user?.id;
    const soloNoLeidas = req.query.soloNoLeidas === 'true';

    if (!usuarioId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const where: any = { usuarioId };
    if (soloNoLeidas) {
      where.leida = false;
    }

    const alertas = await prisma.alertaVencimiento.findMany({
      where,
      include: {
        causaRiesgo: {
          include: {
            riesgo: {
              include: {
                proceso: true
              }
            },
            planesAccion: {
              take: 1,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      },
      orderBy: { fechaGeneracion: 'desc' }
    });

    // Formatear alertas con información del plan
    const alertasFormateadas = alertas.map(alerta => {
      const plan = alerta.causaRiesgo.planesAccion[0];
      return {
        id: alerta.id,
        tipo: alerta.tipo,
        diasRestantes: alerta.diasRestantes,
        leida: alerta.leida,
        fechaGeneracion: alerta.fechaGeneracion,
        plan: {
          causaId: alerta.causaRiesgoId,
          descripcion: plan?.descripcion || alerta.causaRiesgo.descripcion,
          responsable: plan?.responsable,
          fechaEstimada: plan?.fechaFin,
          estado: plan?.estado
        },
        riesgo: {
          id: alerta.causaRiesgo.riesgo?.id,
          numeroIdentificacion: (alerta.causaRiesgo.riesgo as any)?.numeroIdentificacion,
          descripcion: alerta.causaRiesgo.riesgo?.descripcion
        },
        proceso: {
          id: alerta.causaRiesgo.riesgo?.proceso?.id,
          nombre: alerta.causaRiesgo.riesgo?.proceso?.nombre
        }
      };
    });

    // Estadísticas
    const proximasAVencer = alertasFormateadas.filter(a => a.tipo === 'proximo').length;
    const vencidas = alertasFormateadas.filter(a => a.tipo === 'vencido').length;
    const noLeidas = alertasFormateadas.filter(a => !a.leida).length;

    res.json({
      alertas: alertasFormateadas,
      total: alertasFormateadas.length,
      proximasAVencer,
      vencidas,
      noLeidas
    });
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas de vencimiento' });
  }
};

/**
 * PUT /api/alertas/:id/marcar-leida
 * Marca una alerta como leída
 */
export const marcarAlertaLeida = async (req: Request, res: Response) => {
  try {
    const alertaId = Number(req.params.id);
    const user = (req as any).user;
    const usuarioId = user?.userId || user?.id; // Soportar ambos formatos

    if (!usuarioId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Verificar que la alerta existe y pertenece al usuario
    const alerta = await prisma.alertaVencimiento.findUnique({
      where: { id: alertaId }
    });

    if (!alerta) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    if (alerta.usuarioId !== usuarioId) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta alerta' });
    }

    // Marcar como leída
    const alertaActualizada = await prisma.alertaVencimiento.update({
      where: { id: alertaId },
      data: {
        leida: true,
        fechaLectura: new Date()
      }
    });

    res.json({
      success: true,
      alerta: alertaActualizada
    });
  } catch (error) {
    console.error('Error al marcar alerta como leída:', error);
    res.status(500).json({ error: 'Error al marcar alerta como leída' });
  }
};


/**
 * GET /api/planes-accion
 * Obtiene todos los planes de acción desde tabla PlanAccion
 * REFACTORIZADO: Trabaja con tabla PlanAccion normalizada
 */
export const obtenerPlanesAccion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { estado, procesoId } = req.query;

    // Construir filtros
    const where: any = {
      causaRiesgoId: { not: null }
    };

    // Filtrar por estado si se especifica
    if (estado) {
      where.estado = estado;
    }

    // Filtrar por proceso si se especifica
    if (procesoId) {
      where.causaRiesgo = {
        riesgo: {
          procesoId: Number(procesoId)
        }
      };
    }

    // Obtener planes
    const planes = await prisma.planAccion.findMany({
      where,
      include: {
        causaRiesgo: {
          include: {
            riesgo: {
              include: {
                proceso: {
                  select: {
                    id: true,
                    nombre: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transformar a formato esperado por el frontend
    const planesFormateados = planes.map((plan) => ({
      id: plan.id,
      causaRiesgoId: plan.causaRiesgoId,
      riesgoId: plan.riesgoId,
      descripcion: plan.descripcion || 'Sin descripción',
      causaDescripcion: plan.causaRiesgo?.descripcion || '',
      responsable: plan.responsable || '',
      fechaInicio: plan.fechaInicio,
      fechaFin: plan.fechaFin,
      fechaProgramada: plan.fechaProgramada || plan.fechaFin,
      estado: plan.estado,
      observaciones: plan.observaciones || '',
      porcentajeAvance: plan.porcentajeAvance || 0,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      // Datos del riesgo
      riesgo: {
        id: plan.causaRiesgo?.riesgo?.id,
        numeroIdentificacion: plan.causaRiesgo?.riesgo?.numeroIdentificacion,
        descripcion: plan.causaRiesgo?.riesgo?.descripcion,
        proceso: plan.causaRiesgo?.riesgo?.proceso
      }
    }));

    // Estadísticas
    const stats = {
      total: planesFormateados.length,
      pendientes: planesFormateados.filter((p) => p.estado === 'pendiente' || p.estado === 'PENDIENTE').length,
      enRevision: planesFormateados.filter((p) => p.estado === 'en_revision' || p.estado === 'EN_REVISION').length,
      revisados: planesFormateados.filter((p) => p.estado === 'revisado' || p.estado === 'REVISADO' || p.estado === 'COMPLETADO').length,
    };

    console.log('✅ Planes encontrados:', {
      totalPlanes: planesFormateados.length,
      procesoId: procesoId || 'todos',
      estado: estado || 'todos',
      stats
    });

    res.json({
      planes: planesFormateados,
      stats
    });
  } catch (error) {
    console.error('Error al obtener planes de acción:', error);
    res.status(500).json({ error: 'Error al obtener planes de acción' });
  }
};
