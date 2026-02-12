import { Router } from 'express';
import {
  getControlesByRiesgo,
  getControlById,
  createControl,
  updateControl,
  deleteControl,
  getEfectividadPromedio
} from '../controllers/controles.controller';

const router = Router();

// Controles por riesgo
router.get('/riesgo/:riesgoId', getControlesByRiesgo);
router.post('/riesgo/:riesgoId', createControl);
router.get('/riesgo/:riesgoId/efectividad', getEfectividadPromedio);

// Controles individuales
router.get('/:id', getControlById);
router.put('/:id', updateControl);
router.delete('/:id', deleteControl);

export default router;
