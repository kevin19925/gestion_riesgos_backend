import { Router } from 'express';
import {
    actualizarReunion,
    eliminarReunion,
    getAsistencias,
    actualizarAsistencias
} from '../controllers/reuniones.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware());

// Rutas de reuniones individuales
router.put('/:id', actualizarReunion);
router.delete('/:id', eliminarReunion);

// Rutas de asistencias
router.get('/:id/asistencias', getAsistencias);
router.put('/:id/asistencias', actualizarAsistencias);

export default router;
