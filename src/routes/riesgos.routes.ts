import { Router } from 'express';
import { getRiesgos, getRiesgoById, createRiesgo, updateRiesgo, deleteRiesgo, getEstadisticas, getRiesgosRecientes, getPuntosMapa, getCausas, createCausa, updateCausa } from '../controllers/riesgos.controller';
import { getEvaluacionesByRiesgo, createEvaluacion } from '../controllers/evaluaciones.controller';

const router = Router();

// Order matters: specific paths before :id
router.get('/estadisticas', getEstadisticas);
router.get('/recientes', getRiesgosRecientes);
router.get('/mapa', getPuntosMapa);
router.get('/causas', getCausas);
router.post('/causas', createCausa);
router.put('/causas/:id', updateCausa);

router.get('/', getRiesgos);
router.get('/:id', getRiesgoById);
router.post('/', createRiesgo);
router.put('/:id', updateRiesgo);
router.delete('/:id', deleteRiesgo);

// Evaluaciones sub-routes or specific paths
router.get('/:riesgoId/evaluaciones', getEvaluacionesByRiesgo);
router.post('/:riesgoId/evaluaciones', createEvaluacion);
// Note: createEvaluacion might expect riesgoId in body, but hierarchical URL implies context.
// In controller, I used req.body for createEvaluacion. So verify consistency.

export default router;
