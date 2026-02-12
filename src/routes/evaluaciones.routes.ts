import { Router } from 'express';
import { getEvaluacionesByRiesgo, createEvaluacion, getEvaluacionById, updateEvaluacion, deleteEvaluacion } from '../controllers/evaluaciones.controller';

const router = Router();

// GET /evaluaciones/:riesgoId -> Usually GET by ID means getting the evaluation itself.
// But getEvaluacionesByRiesgo implies fetching by foreign key.
router.get('/riesgo/:riesgoId', getEvaluacionesByRiesgo);
router.post('/', createEvaluacion);

// Individual evaluaciones
router.get('/:id', getEvaluacionById);
router.put('/:id', updateEvaluacion);
router.delete('/:id', deleteEvaluacion);

export default router;
