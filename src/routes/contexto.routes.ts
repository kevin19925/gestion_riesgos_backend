import { Router } from 'express';
import {
  getContextoByProceso,
  getContextoById,
  createContexto,
  updateContexto,
  deleteContexto,
  getContextoResumen
} from '../controllers/contexto.controller';

const router = Router();

// Contexto por proceso
router.get('/proceso/:procesoId', getContextoByProceso);
router.post('/proceso/:procesoId', createContexto);
router.get('/proceso/:procesoId/resumen', getContextoResumen);

// Elementos individuales
router.get('/:id', getContextoById);
router.put('/:id', updateContexto);
router.delete('/:id', deleteContexto);

export default router;
