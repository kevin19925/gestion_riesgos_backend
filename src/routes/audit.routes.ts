/**
 * Rutas de Auditoría
 * Define los endpoints para el sistema de auditoría
 */

import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';

const router = Router();

/**
 * GET /api/audit/logs
 * Obtiene el historial de auditoría con filtros
 * Query params: usuarioId, tabla, accion, fechaDesde, fechaHasta, page, pageSize
 */
router.get('/logs', auditController.getLogs);

/**
 * GET /api/audit/logs/:id
 * Obtiene un registro de auditoría específico
 */
router.get('/logs/:id', auditController.getLogById);

/**
 * GET /api/audit/stats
 * Obtiene estadísticas generales de auditoría
 */
router.get('/stats', auditController.getStats);

export default router;
