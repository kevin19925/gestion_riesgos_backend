import { Router } from 'express';
import {
  createControlRiesgo,
  updateControlRiesgo,
  deleteControlRiesgo,
  getControlesByCausa,
  getControlById
} from '../controllers/control-riesgo.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Middleware de autenticación para todas las rutas
const auth = authMiddleware({ required: true });

/**
 * RUTAS PARA CONTROL RIESGO
 * Gestión de controles asociados a causas de riesgo
 */

// Controles por causa
router.get('/causa/:causaRiesgoId', auth, getControlesByCausa);
router.post('/causa/:causaRiesgoId', auth, createControlRiesgo);

// Control individual
router.get('/:id', auth, getControlById);
router.put('/:id', auth, updateControlRiesgo);
router.delete('/:id', auth, deleteControlRiesgo);

export default router;
