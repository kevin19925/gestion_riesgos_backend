import { Router } from 'express';
import {
  getDofaByProceso,
  getDofaElementoById,
  createDofaElemento,
  updateDofaElemento,
  deleteDofaElemento,
  getDofaEstrategias
} from '../controllers/dofa.controller';

const router = Router();

// DOFA por proceso
router.get('/proceso/:procesoId', getDofaByProceso);
router.post('/proceso/:procesoId', createDofaElemento);
router.get('/proceso/:procesoId/estrategias', getDofaEstrategias);

// Elementos individuales
router.get('/:id', getDofaElementoById);
router.put('/:id', updateDofaElemento);
router.delete('/:id', deleteDofaElemento);

export default router;
