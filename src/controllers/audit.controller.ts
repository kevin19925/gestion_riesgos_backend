/**
 * Controlador de Auditoría
 * Maneja las peticiones HTTP para el sistema de auditoría
 */

import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';
import { redisGet, redisSet } from '../redisClient';

const CACHE_TTL_AUDIT_LOGS = 30; // 30 segundos para no saturar BD al cambiar de pestaña

/**
 * GET /api/audit/logs
 * Obtiene el historial de auditoría con filtros y paginación (con caché corto)
 */
export async function getLogs(req: Request, res: Response) {
  try {
    const {
      usuarioId,
      tabla,
      accion,
      fechaDesde,
      fechaHasta,
      page,
      pageSize,
    } = req.query;

    const filtros: auditService.FiltrosAuditoria = {
      usuarioId: usuarioId ? Number(usuarioId) : undefined,
      tabla: tabla as string,
      accion: accion as string,
      fechaDesde: fechaDesde ? new Date(fechaDesde as string) : undefined,
      fechaHasta: fechaHasta ? new Date(fechaHasta as string) : undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    };

    const cacheKey = `audit:logs:${filtros.usuarioId ?? 'all'}:${filtros.tabla ?? ''}:${filtros.accion ?? ''}:${filtros.page}:${filtros.pageSize}:${filtros.fechaDesde?.toISOString() ?? ''}:${filtros.fechaHasta?.toISOString() ?? ''}`;
    try {
      const cached = await redisGet<any>(cacheKey);
      if (cached) return res.json(cached);
    } catch (_) { /* Redis no disponible: seguir sin caché */ }

    const resultado = await auditService.obtenerHistorial(filtros);

    try {
      await redisSet(cacheKey, resultado, CACHE_TTL_AUDIT_LOGS);
    } catch (_) { /* Redis no disponible: no guardar caché */ }

    res.json(resultado);
  } catch (error: any) {
    console.error('Error obteniendo logs de auditoría:', error);
    res.status(500).json({
      error: 'Error al obtener el historial de auditoría',
      message: error.message,
    });
  }
}

/**
 * GET /api/audit/logs/:id
 * Obtiene un registro de auditoría específico
 */
export async function getLogById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        error: 'ID inválido',
        message: 'El ID debe ser un número',
      });
    }

    const log = await auditService.obtenerLogPorId(id);

    if (!log) {
      return res.status(404).json({
        error: 'No encontrado',
        message: 'Registro de auditoría no encontrado',
      });
    }

    res.json({ data: log });
  } catch (error: any) {
    console.error('Error obteniendo log de auditoría:', error);
    res.status(500).json({
      error: 'Error al obtener el registro de auditoría',
      message: error.message,
    });
  }
}

/**
 * GET /api/audit/stats
 * Obtiene estadísticas generales de auditoría
 */
export async function getStats(req: Request, res: Response) {
  try {
    const stats = await auditService.obtenerEstadisticas();
    res.json(stats);
  } catch (error: any) {
    console.error('Error obteniendo estadísticas de auditoría:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      message: error.message,
    });
  }
}
