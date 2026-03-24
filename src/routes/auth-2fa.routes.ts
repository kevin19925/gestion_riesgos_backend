import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as auth2FAController from '../controllers/auth-2fa.controller';

const router = Router();

// Middleware de autenticación
const authenticateToken = authMiddleware({ required: true });

/**
 * Rutas para autenticación de dos factores (2FA)
 * Todas las rutas excepto verify-login requieren autenticación
 */

// Setup y configuración de 2FA (requiere autenticación)
router.post('/setup', authenticateToken, auth2FAController.setup2FA);
router.post('/verify-setup', authenticateToken, auth2FAController.verifySetup2FA);
router.post('/disable', authenticateToken, auth2FAController.disable2FA);
router.post('/regenerate-recovery', authenticateToken, auth2FAController.regenerateRecoveryCodes);

// Verificación durante login (NO requiere autenticación previa)
router.post('/verify-login', auth2FAController.verifyLogin2FA);

// Estado y dispositivos (requiere autenticación)
router.get('/status', authenticateToken, auth2FAController.get2FAStatus);
router.get('/trusted-devices', authenticateToken, auth2FAController.getTrustedDevices);
router.delete('/trusted-devices/:id', authenticateToken, auth2FAController.revokeTrustedDevice);

export default router;
