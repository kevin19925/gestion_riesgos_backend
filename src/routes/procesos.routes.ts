import { Router } from 'express';
import { getProcesos, getProcesoById, createProceso, updateProceso, deleteProceso, duplicateProceso } from '../controllers/procesos.controller';

const router = Router();

router.get('/', getProcesos);
router.get('/:id', getProcesoById);
router.post('/', createProceso);
router.post('/:id/duplicate', duplicateProceso);
router.put('/:id', updateProceso);
router.delete('/:id', deleteProceso);

export default router;
