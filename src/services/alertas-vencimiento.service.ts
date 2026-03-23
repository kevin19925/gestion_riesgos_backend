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
 * REFACTORIZADO: Trabaja con tabla PlanAccion normalizada
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

    // 1. Buscar todos los planes activos con causaRiesgoId
    const planesActivos = await prisma.planAccion.findMany({
      where: {
        causaRiesgoId: { not: null },
        estado: { notIn: ['COMPLETADO', 'CANCELADO', 'completado', 'cancelado'] },
        fechaFin: { not: null }
      },
      include: {
        causaRiesgo: {
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
        }
      }
    });

    detalles.push(`Encontrados ${planesActivos.length} planes activos`);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche

    // 2. Procesar cada plan
    for (const plan of planesActivos) {
      try {
        // Validar que tiene fecha de fin
        if (!plan.fechaFin || !plan.causaRiesgoId) {
          continue;
        }

        // Calcular días restantes
        const fechaFin = new Date(plan.fechaFin);
        fechaFin.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

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

        if (plan.causaRiesgo?.riesgo?.proceso?.responsables) {
          for (const responsable of plan.causaRiesgo.riesgo.proceso.responsables) {
            if (responsable.usuario?.id) {
              usuariosANotificar.push(responsable.usuario.id);
            }
          }
        }

        // Si no hay responsables, buscar supervisores generales
        if (usuariosANotificar.length === 0) {
          const supervisores = await prisma.usuario.findMany({
            where: {
              roleRelacion: {
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
                causaRiesgoId: plan.causaRiesgoId,
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
                causaRiesgoId: plan.causaRiesgoId,
                usuarioId,
                tipo: tipoAlerta,
                diasRestantes,
                leida: false
              }
            });

            generadas++;
          } catch (error) {
            errores++;
            detalles.push(`Error al crear alerta para usuario ${usuarioId}, plan ${plan.id}: ${error}`);
          }
        }
      } catch (error) {
        errores++;
        detalles.push(`Error al procesar plan ${plan.id}: ${error}`);
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
 * REFACTORIZADO: Trabaja con tabla PlanAccion normalizada
 */
export async function generarAlertaParaPlan(causaRiesgoId: number): Promise<boolean> {
  try {
    // Buscar el plan asociado a esta causa
    const plan = await prisma.planAccion.findFirst({
      where: {
        causaRiesgoId,
        estado: { notIn: ['COMPLETADO', 'CANCELADO', 'completado', 'cancelado'] },
        fechaFin: { not: null }
      },
      include: {
        causaRiesgo: {
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
        }
      }
    });

    if (!plan || !plan.fechaFin) {
      return false;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaFin = new Date(plan.fechaFin);
    fechaFin.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

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
    if (plan.causaRiesgo?.riesgo?.proceso?.responsables) {
      for (const responsable of plan.causaRiesgo.riesgo.proceso.responsables) {
        if (responsable.usuario?.id) {
          usuariosANotificar.push(responsable.usuario.id);
        }
      }
    }

    // Crear alertas
    for (const usuarioId of usuariosANotificar) {
      await prisma.alertaVencimiento.create({
        data: {
          causaRiesgoId,
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
