import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * PLAN TRAZABILIDAD CONTROLLER
 * Gestiona la trazabilidad y evolución de planes de acción en CausaRiesgo.gestion
 */

/**
 * PUT /api/causas/:id/plan/estado
 * Cambia el estado de un plan de acción
 */
export const cambiarEstadoPlan = async (req: Request, res: Response) => {
  try {
    const causaId = Number(req.params.id);
    const { estado, observacion } = req.body;

    // Validar estado
    const estadosValidos = ['en_revision', 'revisado'];
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

    // Verificar que tiene plan
    if (!causa.tipoGestion || !['PLAN', 'AMBOS'].includes(causa.tipoGestion)) {
      return res.status(400).json({
        error: 'Esta causa no tiene un plan de acción asociado'
      });
    }

    const gestion = (causa.gestion as any) || {};

    // Crear entrada en historial de estados
    const historialEstados = gestion.historialEstados || [];
    historialEstados.push({
      estado,
      fecha: new Date().toISOString(),
      usuario: (req as any).user?.nombre || 'Sistema',
      observacion: observacion || ''
    });

    // Actualizar gestion con nuevo estado
    const gestionActualizada = {
      ...gestion,
      planEstado: estado,
      historialEstados
    };

    // Actualizar en BD
    const causaActualizada = await prisma.causaRiesgo.update({
      where: { id: causaId },
      data: { gestion: gestionActualizada }
    });

    // Log para debugging
    console.log('✅ Estado actualizado:', {
      causaId,
      estadoAnterior: gestion.planEstado,
      estadoNuevo: estado,
      gestionGuardada: (causaActualizada.gestion as any)?.planEstado
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
        seccion: 'estado',
        entidadTipo: 'CausaRiesgo',
        entidadId: causaId,
        accion: 'UPDATE',
        descripcion: `Cambio de estado del plan: ${gestion.planEstado || 'sin estado'} → ${estado}`,
        valorAnterior: gestion.planEstado || 'sin estado',
        valorNuevo: estado
      }
    });

    res.json({
      success: true,
      causa: causaActualizada,
      estadoAnterior: gestion.planEstado,
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

    // Verificar que tiene plan
    if (!causa.tipoGestion || !['PLAN', 'AMBOS'].includes(causa.tipoGestion)) {
      return res.status(400).json({
        error: 'Esta causa no tiene un plan de acción asociado'
      });
    }

    const gestion = (causa.gestion as any) || {};

    // Verificar que el plan está completado
    if (gestion.planEstado !== 'completado') {
      return res.status(400).json({
        error: 'Solo se pueden convertir planes completados',
        estadoActual: gestion.planEstado || 'sin estado'
      });
    }

    // Verificar que no fue convertido previamente
    if (gestion.controlDerivadoId) {
      return res.status(400).json({
        error: 'Este plan ya fue convertido a control',
        controlId: gestion.controlDerivadoId
      });
    }

    // Verificar que tiene riesgo asociado
    if (!causa.riesgoId) {
      return res.status(400).json({
        error: 'La causa debe tener un riesgo asociado para crear un control'
      });
    }

    // Crear el control
    const nuevoControl = await prisma.control.create({
      data: {
        riesgoId: causa.riesgoId,
        descripcion: gestion.planDescripcion || gestion.planDetalle || causa.descripcion,
        tipoControl,
        diseño: 3, // Valor por defecto
        ejecucion: 3, // Valor por defecto
        solidez: 3, // Valor por defecto
        efectividad: 0.75, // 75% por defecto para controles derivados de planes exitosos
        riesgoResidual: 0,
        clasificacionResidual: 'Por evaluar',
        causaRiesgoOrigenId: causaId,
        fechaCreacionDesdePlan: new Date()
      }
    });

    // Actualizar gestion del plan con referencia al control
    const gestionActualizada = {
      ...gestion,
      controlDerivadoId: nuevoControl.id,
      fechaConversion: new Date().toISOString(),
      observacionesConversion: observaciones || ''
    };

    // Actualizar causa
    const causaActualizada = await prisma.causaRiesgo.update({
      where: { id: causaId },
      data: { gestion: gestionActualizada }
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
        entidadTipo: 'CausaRiesgo',
        entidadId: causaId,
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
      causa: causaActualizada,
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

    const gestion = (causa.gestion as any) || {};

    // Obtener control derivado si existe
    let controlDerivado = null;
    if (gestion.controlDerivadoId) {
      controlDerivado = await prisma.control.findUnique({
        where: { id: gestion.controlDerivadoId }
      });
    }

    // Obtener historial de eventos relacionados
    const historialEventos = await prisma.historialEvento.findMany({
      where: {
        entidadTipo: 'CausaRiesgo',
        entidadId: causaId
      },
      orderBy: { fecha: 'desc' },
      take: 50
    });

    // Construir respuesta de trazabilidad
    const trazabilidad = {
      causa: {
        id: causa.id,
        descripcion: causa.descripcion,
        tipoGestion: causa.tipoGestion,
        riesgo: {
          id: causa.riesgo?.id,
          numeroIdentificacion: (causa.riesgo as any)?.numeroIdentificacion,
          descripcion: causa.riesgo?.descripcion,
          proceso: causa.riesgo?.proceso?.nombre
        }
      },
      plan: {
        descripcion: gestion.planDescripcion,
        responsable: gestion.planResponsable,
        fechaEstimada: gestion.planFechaEstimada,
        estado: gestion.planEstado,
        detalle: gestion.planDetalle,
        decision: gestion.planDecision
      },
      historialEstados: gestion.historialEstados || [],
      controlDerivado: controlDerivado ? {
        id: controlDerivado.id,
        descripcion: controlDerivado.descripcion,
        tipoControl: controlDerivado.tipoControl,
        efectividad: controlDerivado.efectividad,
        fechaCreacion: gestion.fechaConversion
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
 */
export const obtenerAlertasVencimiento = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const usuarioId = user?.userId || user?.id; // Soportar ambos formatos
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
            }
          }
        }
      },
      orderBy: { fechaGeneracion: 'desc' }
    });

    // Formatear alertas con información del plan
    const alertasFormateadas = alertas.map(alerta => {
      const gestion = (alerta.causaRiesgo.gestion as any) || {};
      return {
        id: alerta.id,
        tipo: alerta.tipo,
        diasRestantes: alerta.diasRestantes,
        leida: alerta.leida,
        fechaGeneracion: alerta.fechaGeneracion,
        plan: {
          causaId: alerta.causaRiesgoId,
          descripcion: gestion.planDescripcion || alerta.causaRiesgo.descripcion,
          responsable: gestion.planResponsable,
          fechaEstimada: gestion.planFechaEstimada,
          estado: gestion.planEstado
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
 * Obtiene todos los planes de acción desde CausaRiesgo.gestion
 */
export const obtenerPlanesAccion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { estado, procesoId } = req.query;

    // Construir filtros
    const where: any = {
      tipoGestion: { in: ['PLAN', 'AMBOS'] }
    };

    // Filtrar por proceso si se especifica
    if (procesoId) {
      where.riesgo = {
        procesoId: Number(procesoId)
      };
    }

    // Obtener causas con planes
    const causas = await prisma.causaRiesgo.findMany({
      where,
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
      },
      orderBy: { id: 'desc' }
    });

    // Transformar a formato de planes
    const planes = causas
      .map((causa) => {
        const gestion = (causa.gestion as any) || {};
        
        // Log para debugging
        console.log('📋 Procesando causa:', {
          causaId: causa.id,
          tipoGestion: causa.tipoGestion,
          tieneGestion: !!gestion,
          planDescripcion: gestion.planDescripcion,
          planDetalle: gestion.planDetalle,
          planResponsable: gestion.planResponsable,
          riesgoId: causa.riesgoId,
          procesoId: causa.riesgo?.procesoId
        });
        
        // Verificar que tenga datos de plan
        // CAMBIADO: Aceptar si tiene planDescripcion O planDetalle O planResponsable
        const tienePlan = gestion.planDescripcion || gestion.planDetalle || gestion.planResponsable;
        if (!tienePlan) {
          console.log('⚠️ Causa sin datos de plan, omitiendo:', causa.id);
          return null;
        }

        // Mapear estado del JSON al formato del frontend
        let estadoFrontend = 'en_revision';
        if (gestion.planEstado) {
          const estadoMap: Record<string, string> = {
            'en_revision': 'en_revision',
            'revisado': 'revisado',
            // Mapeo de estados antiguos a nuevos
            'pendiente': 'en_revision',
            'en_progreso': 'en_revision',
            'completado': 'revisado',
            'cancelado': 'en_revision',
          };
          estadoFrontend = estadoMap[gestion.planEstado] || 'en_revision';
        }

        return {
          id: causa.id,
          causaRiesgoId: causa.id,
          riesgoId: causa.riesgoId,
          descripcion: gestion.planDescripcion || gestion.planDetalle || causa.descripcion || 'Sin descripción',
          causaDescripcion: causa.descripcion || '', // AGREGADO: Descripción de la causa
          responsable: gestion.planResponsable || '',
          fechaInicio: gestion.planFechaInicio || null,
          fechaFin: gestion.planFechaEstimada || null,
          fechaProgramada: gestion.planFechaEstimada || null,
          estado: estadoFrontend,
          observaciones: gestion.planDetalle || '',
          controlDerivadoId: gestion.controlDerivadoId || null,
          fechaConversion: gestion.fechaConversion || null,
          createdAt: (causa as any).createdAt || new Date().toISOString(),
          updatedAt: (causa as any).updatedAt || new Date().toISOString(),
          // Datos del riesgo
          riesgo: {
            id: causa.riesgo?.id,
            numeroIdentificacion: causa.riesgo?.numeroIdentificacion,
            descripcion: causa.riesgo?.descripcion,
            proceso: causa.riesgo?.proceso
          }
        };
      })
      .filter((plan) => plan !== null);

    // Filtrar por estado si se especifica
    let planesFiltrados = planes;
    if (estado) {
      planesFiltrados = planes.filter((plan) => plan.estado === estado);
    }

    // Estadísticas
    const stats = {
      total: planes.length,
      enRevision: planes.filter((p) => p.estado === 'en_revision').length,
      revisados: planes.filter((p) => p.estado === 'revisado').length,
    };

    console.log('✅ Planes encontrados:', {
      totalCausas: causas.length,
      totalPlanes: planes.length,
      planesFiltrados: planesFiltrados.length,
      procesoId: procesoId || 'todos',
      stats
    });

    res.json({
      planes: planesFiltrados,
      stats
    });
  } catch (error) {
    console.error('Error al obtener planes de acción:', error);
    res.status(500).json({ error: 'Error al obtener planes de acción' });
  }
};
