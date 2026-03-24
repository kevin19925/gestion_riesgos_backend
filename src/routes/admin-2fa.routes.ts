import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as admin2FAController from '../controllers/admin-2fa.controller';

const router = Router();

// Middleware de autenticación
const authenticateToken = authMiddleware({ required: true });

/**
 * Rutas para administración de 2FA
 * Todas requieren autenticación y rol de administrador
 */

// Middleware para verificar rol de administrador
const requireAdmin = (req: any, res: any, next: any) => {
  const userRole = req.user?.role;
  
  if (userRole !== 'ADMIN' && userRole !== 'admin' && userRole !== 'gerente_general') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  
  next();
};

// Todas las rutas requieren autenticación y rol admin
router.use(authenticateToken);
router.use(requireAdmin);

// Configuración global
router.get('/config', admin2FAController.getGlobalConfig);
router.put('/config', admin2FAController.updateGlobalConfig);

// Gestión de usuarios
router.get('/users', admin2FAController.getUsersWith2FA);
router.post('/force-disable/:userId', admin2FAController.forceDisable2FA);

// Auditoría y estadísticas
router.get('/audit', admin2FAController.getAuditLogs);
router.get('/stats', admin2FAController.get2FAStats);

// Mantenimiento
router.post('/clean-expired-devices', admin2FAController.cleanExpiredDevices);

export default router;
