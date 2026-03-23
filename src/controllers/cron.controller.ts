import { Request, Response } from 'express';
import { ejecutarManualmente, obtenerEstadoCron } from '../services/cron.service';
import { obtenerEstadisticasAlertas } from '../services/alertas-vencimiento.service';

/**
 * CRON CONTROLLER
 * Endpoints para gestionar y monitorear el servicio de cron jobs
 */

/**
 * GET /api/cron/estado
 * Obtiene el estado actual del servicio de cron
 */
export const obtenerEstado = async (req: Request, res: Response) => {
  try {
    const estadoCron = obtenerEstadoCron();
    const estadisticasAlertas = await obtenerEstadisticasAlertas();

    res.json({
      cron: estadoCron,
      alertas: estadisticasAlertas
    });
  } catch (error) {
    console.error('Error al obtener estado del cron:', error);
    res.status(500).json({ error: 'Error al obtener estado del cron' });
  }
};

/**
 * POST /api/cron/ejecutar-alertas
 * Ejecuta manualmente la generación de alertas (solo para admin)
 */
export const ejecutarAlertasManualmente = async (req: Request, res: Response) => {
  try {
    const usuario = (req as any).user;

    // Solo admin puede ejecutar manualmente
    if (usuario?.role !== 'admin') {
      return res.status(403).json({
        error: 'Solo administradores pueden ejecutar esta acción'
      });
    }

    console.log(`[CRON] Ejecución manual solicitada por: ${usuario.nombre} (${usuario.email})`);

    await ejecutarManualmente();

    res.json({
      success: true,
      message: 'Generación de alertas ejecutada correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al ejecutar alertas manualmente:', error);
    res.status(500).json({ error: 'Error al ejecutar alertas manualmente' });
  }
};
