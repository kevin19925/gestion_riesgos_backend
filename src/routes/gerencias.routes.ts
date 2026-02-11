import { Router } from 'express';
import { getGerencias, getGerenciaById, createGerencia, updateGerencia, deleteGerencia } from '../controllers/gerencias.controller';

const router = Router();

router.get('/', getGerencias);
router.get('/:id', getGerenciaById);
router.post('/', createGerencia);
router.put('/:id', updateGerencia);
router.delete('/:id', deleteGerencia);

export default router;
