import { Router } from 'express';
import { getProcesos, getProcesoById, createProceso, updateProceso, deleteProceso, duplicateProceso, bulkUpdateProcesos } from '../controllers/procesos.controller';

const router = Router();

// Static routes first (before dynamic :id routes)
router.put('/bulk', bulkUpdateProcesos);
router.post('/:id/duplicate', duplicateProceso);

// Dynamic routes
router.get('/', getProcesos);
router.post('/', createProceso);
router.get('/:id', getProcesoById);
router.put('/:id', updateProceso);
router.delete('/:id', deleteProceso);

export default router;
