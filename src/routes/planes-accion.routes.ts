import { Router } from 'express';
import {
  getPlanes,
  getPlanesByRiesgo,
  getPlanesByIncidencia,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  getPlanesVencidos,
  getPlanesEstadisticas
} from '../controllers/planes-accion.controller';

const router = Router();

// Listado general
router.get('/', getPlanes);

// Planes por riesgo (preventivos)
router.get('/riesgo/:riesgoId', getPlanesByRiesgo);
router.post('/riesgo/:riesgoId', createPlan);

// Planes por incidencia (reactivos)
router.get('/incidencia/:incidenciaId', getPlanesByIncidencia);
router.post('/incidencia/:incidenciaId', createPlan);

// Queries especiales
router.get('/vencidos', getPlanesVencidos);
router.get('/estadisticas', getPlanesEstadisticas);

// Planes individuales
router.get('/:id', getPlanById);
router.put('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;
