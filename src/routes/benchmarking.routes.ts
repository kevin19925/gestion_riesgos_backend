import { Router } from 'express';
import { getBenchmarkingByProceso, setBenchmarkingByProceso, deleteBenchmarkingItem } from '../controllers/benchmarking.controller';

const router = Router();

router.get('/proceso/:procesoId', getBenchmarkingByProceso);
router.put('/proceso/:procesoId', setBenchmarkingByProceso);
router.delete('/:id', deleteBenchmarkingItem);

export default router;
