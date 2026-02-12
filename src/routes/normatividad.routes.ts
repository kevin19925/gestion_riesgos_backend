import { Router } from 'express';
import {
  getNormatividadByProceso,
  getNormatividadById,
  createNormatividad,
  updateNormatividad,
  deleteNormatividad,
  getNormatividadEstadisticas
} from '../controllers/normatividad.controller';

const router = Router();

// Normatividad por proceso
router.get('/proceso/:procesoId', getNormatividadByProceso);
router.post('/proceso/:procesoId', createNormatividad);
router.get('/proceso/:procesoId/estadisticas', getNormatividadEstadisticas);

// Elementos individuales
router.get('/:id', getNormatividadById);
router.put('/:id', updateNormatividad);
router.delete('/:id', deleteNormatividad);

export default router;
