import { Router } from 'express';
import {
  getDofaByProceso,
  getDofaElementoById,
  createDofaElemento,
  updateDofaElemento,
  deleteDofaElemento,
} from '../controllers/dofa.controller';

const router = Router();

// DOFA por proceso (solo Fortalezas, Oportunidades, Debilidades, Amenazas)
router.get('/proceso/:procesoId', getDofaByProceso);
router.post('/proceso/:procesoId', createDofaElemento);

// Elementos individuales
router.get('/:id', getDofaElementoById);
router.put('/:id', updateDofaElemento);
router.delete('/:id', deleteDofaElemento);

export default router;
