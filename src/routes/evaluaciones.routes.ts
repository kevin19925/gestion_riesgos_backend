import { Router } from 'express';
import { getEvaluacionesByRiesgo, createEvaluacion } from '../controllers/evaluaciones.controller';

const router = Router();

// GET /evaluaciones/:riesgoId -> Usually GET by ID means getting the evaluation itself.
// But getEvaluacionesByRiesgo implies fetching by foreign key.
router.get('/riesgo/:riesgoId', getEvaluacionesByRiesgo);
router.post('/', createEvaluacion);

export default router;
