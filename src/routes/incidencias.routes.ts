import { Router } from 'express';
import {
  getIncidencias,
  getIncidenciasByRiesgo,
  getIncidenciaById,
  createIncidencia,
  updateIncidencia,
  deleteIncidencia,
  getIncidenciasByPeriodo,
  getIncidenciasEstadisticas
} from '../controllers/incidencias.controller';

const router = Router();

// Listado general (filtros por query: procesoId, riesgoId)
router.get('/', getIncidencias);
router.post('/', createIncidencia); // Crear incidencia con riesgoId en body

// Incidencias por riesgo
router.get('/riesgo/:riesgoId', getIncidenciasByRiesgo);
router.post('/riesgo/:riesgoId', createIncidencia); // Crear con riesgoId en param

// Queries especiales
router.get('/periodo', getIncidenciasByPeriodo);
router.get('/estadisticas', getIncidenciasEstadisticas);

// Incidencias individuales
router.get('/:id', getIncidenciaById);
router.put('/:id', updateIncidencia);
router.delete('/:id', deleteIncidencia);

export default router;
