import { Router } from 'express';
import { obtenerEstado, ejecutarAlertasManualmente } from '../controllers/cron.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware({ required: true }));

// Estado del cron (cualquier usuario autenticado)
router.get('/estado', obtenerEstado);

// Ejecutar manualmente (solo admin)
router.post('/ejecutar-alertas', ejecutarAlertasManualmente);

export default router;
