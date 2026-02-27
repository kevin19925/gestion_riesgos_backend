/**
 * Rutas de Configuración Residual
 */

import { Router } from 'express';
import {
  getConfiguracion,
  updateConfiguracion,
  recalcularRiesgos
} from '../controllers/configuracionResidual.controller';

const router = Router();

// GET /api/configuracion-residual - Obtener configuración activa
router.get('/', getConfiguracion);

// PUT /api/configuracion-residual/:id - Actualizar configuración
router.put('/:id', updateConfiguracion);

// POST /api/configuracion-residual/recalcular - Recalcular todos los riesgos
router.post('/recalcular', recalcularRiesgos);

export default router;
