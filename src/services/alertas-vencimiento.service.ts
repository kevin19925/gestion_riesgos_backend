import prisma from '../prisma';

/**
 * SERVICIO DE ALERTAS DE VENCIMIENTO
 * Genera alertas automáticas para planes próximos a vencer o vencidos
 */

interface AlertaGenerada {
  causaRiesgoId: number;
  usuarioId: number;
  tipo: 'proximo' | 'vencido';
  diasRestantes: number;
}

/**
 * Genera alertas de vencimiento para todos los planes activos
 * Se ejecuta diariamente a las 08:00 AM
 */
export async function generarAlertasVencimiento(): Promise<{
  generadas: number;
  errores: number;
  detalles: string[];
}> {
  const detalles: string[] = [];
  let generadas = 0;
  let errores = 0;

  try {
    detalles.push(`[${new Date().toISOString()}] Iniciando generación de alertas...`);

    // 1. Buscar todas las causas con planes activos
    const causasConPlanes = await prisma.causaRiesgo.findMany({
      where: {
        tipoGestion: { in: ['PLAN', 'AMBOS'] },
        gestion: { not: null }
      },
      include: {
        riesgo: {
          include: {
            proceso: {
              include: {
                responsables: {
                  include: {
                    usuario: true
                  }
                }
              }
            }
          }
        }
      }
    });

    detalles.push(`Encontradas ${causasConPlanes.length} causas con planes`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche

    // 2. Procesar cada causa
    for (const causa of causasConPlanes) {
      try {
        const gestion = causa.gestion as any;

        // Validar que tiene datos del plan
        if (!gestion || !gestion.planFechaEstimada) {
          continue;
        }

        // Validar que el plan no está completado o cancelado
        const estado = gestion.planEstado || 'pendiente';
        if (estado === 'completado' || estado === 'cancelado') {
          continue;
        }

        // Calcular días restantes
        const fechaEstimada = new Date(gestion.planFechaEstimada);
        fechaEstimada.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((fechaEstimada.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        // Determinar si necesita alerta
        let tipoAlerta: 'proximo' | 'vencido' | null = null;

        if (diasRestantes < 0) {
          tipoAlerta = 'vencido';
        } else if (diasRestantes >= 0 && diasRestantes <= 7) {
          tipoAlerta = 'proximo';
        }

        // Si no necesita alerta, continuar
        if (!tipoAlerta) {
          continue;
        }

        // 3. Obtener usuarios a notificar (responsables del proceso)
        const usuariosANotificar: number[] = [];

        if (causa.riesgo?.proceso?.responsables) {
          for (const responsable of causa.riesgo.proceso.responsables) {
            if (responsable.usuario?.id) {
              usuariosANotificar.push(responsable.usuario.id);
            }
          }
        }

        // Si no hay responsables, buscar supervisores generales
        if (usuariosANotificar.length === 0) {
          const supervisores = await prisma.usuario.findMany({
            where: {
              role: {
                codigo: { in: ['supervisor', 'gerente'] }
              },
              activo: true
            },
            select: { id: true }
          });
          usuariosANotificar.push(...supervisores.map(s => s.id));
        }

        // 4. Crear alertas para cada usuario (evitando duplicados)
        for (const usuarioId of usuariosANotificar) {
          try {
            // Verificar si ya existe una alerta similar reciente (últimas 24 horas)
            const alertaExistente = await prisma.alertaVencimiento.findFirst({
              where: {
                causaRiesgoId: causa.id,
                usuarioId,
                tipo: tipoAlerta,
                fechaGeneracion: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
                }
              }
            });

            if (alertaExistente) {
              // Ya existe una alerta reciente, actualizar días restantes
              await prisma.alertaVencimiento.update({
                where: { id: alertaExistente.id },
                data: { diasRestantes }
              });
              continue;
            }

            // Crear nueva alerta
            await prisma.alertaVencimiento.create({
              data: {
                causaRiesgoId: causa.id,
                usuarioId,
                tipo: tipoAlerta,
                diasRestantes,
                leida: false
              }
            });

            generadas++;
          } catch (error) {
            errores++;
            detalles.push(`Error al crear alerta para usuario ${usuarioId}, causa ${causa.id}: ${error}`);
          }
        }
      } catch (error) {
        errores++;
        detalles.push(`Error al procesar causa ${causa.id}: ${error}`);
      }
    }

    detalles.push(`Proceso completado: ${generadas} alertas generadas, ${errores} errores`);

    // 5. Limpiar alertas antiguas leídas (más de 30 días)
    const alertasEliminadas = await prisma.alertaVencimiento.deleteMany({
      where: {
        leida: true,
        fechaLectura: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    detalles.push(`Limpieza: ${alertasEliminadas.count} alertas antiguas eliminadas`);

    return { generadas, errores, detalles };
  } catch (error) {
    errores++;
    detalles.push(`Error crítico en generación de alertas: ${error}`);
    console.error('Error en generarAlertasVencimiento:', error);
    return { generadas, errores, detalles };
  }
}

/**
 * Genera alertas para un plan específico (uso manual o por evento)
 */
export async function generarAlertaParaPlan(causaRiesgoId: number): Promise<boolean> {
  try {
    const causa = await prisma.causaRiesgo.findUnique({
      where: { id: causaRiesgoId },
      include: {
        riesgo: {
          include: {
            proceso: {
              include: {
                responsables: {
                  include: {
                    usuario: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!causa) {
      return false;
    }

    const gestion = causa.gestion as any;
    if (!gestion || !gestion.planFechaEstimada) {
      return false;
    }

    const estado = gestion.planEstado || 'pendiente';
    if (estado === 'completado' || estado === 'cancelado') {
      return false;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEstimada = new Date(gestion.planFechaEstimada);
    fechaEstimada.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaEstimada.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    let tipoAlerta: 'proximo' | 'vencido' | null = null;
    if (diasRestantes < 0) {
      tipoAlerta = 'vencido';
    } else if (diasRestantes >= 0 && diasRestantes <= 7) {
      tipoAlerta = 'proximo';
    }

    if (!tipoAlerta) {
      return false;
    }

    // Obtener usuarios a notificar
    const usuariosANotificar: number[] = [];
    if (causa.riesgo?.proceso?.responsables) {
      for (const responsable of causa.riesgo.proceso.responsables) {
        if (responsable.usuario?.id) {
          usuariosANotificar.push(responsable.usuario.id);
        }
      }
    }

    // Crear alertas
    for (const usuarioId of usuariosANotificar) {
      await prisma.alertaVencimiento.create({
        data: {
          causaRiesgoId: causa.id,
          usuarioId,
          tipo: tipoAlerta,
          diasRestantes,
          leida: false
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Error en generarAlertaParaPlan:', error);
    return false;
  }
}

/**
 * Obtiene estadísticas de alertas del sistema
 */
export async function obtenerEstadisticasAlertas(): Promise<{
  totalAlertas: number;
  alertasNoLeidas: number;
  alertasVencidas: number;
  alertasProximas: number;
  planesConAlertas: number;
}> {
  try {
    const [
      totalAlertas,
      alertasNoLeidas,
      alertasVencidas,
      alertasProximas,
      planesConAlertas
    ] = await Promise.all([
      prisma.alertaVencimiento.count(),
      prisma.alertaVencimiento.count({ where: { leida: false } }),
      prisma.alertaVencimiento.count({ where: { tipo: 'vencido' } }),
      prisma.alertaVencimiento.count({ where: { tipo: 'proximo' } }),
      prisma.alertaVencimiento.groupBy({
        by: ['causaRiesgoId'],
        _count: true
      })
    ]);

    return {
      totalAlertas,
      alertasNoLeidas,
      alertasVencidas,
      alertasProximas,
      planesConAlertas: planesConAlertas.length
    };
  } catch (error) {
    console.error('Error en obtenerEstadisticasAlertas:', error);
    return {
      totalAlertas: 0,
      alertasNoLeidas: 0,
      alertasVencidas: 0,
      alertasProximas: 0,
      planesConAlertas: 0
    };
  }
}
