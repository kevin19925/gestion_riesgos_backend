/**
 * Routes para gestionar múltiples responsables por proceso
 */

import { Router } from 'express';
import {
    getResponsablesByProceso,
    addResponsableToProceso,
    removeResponsableFromProceso,
    updateResponsablesProceso
} from '../controllers/proceso-responsables.controller';

const router = Router();

// GET /api/procesos/:procesoId/responsables
router.get('/:procesoId/responsables', getResponsablesByProceso);

// POST /api/procesos/:procesoId/responsables
router.post('/:procesoId/responsables', addResponsableToProceso);

// DELETE /api/procesos/:procesoId/responsables/:usuarioId
router.delete('/:procesoId/responsables/:usuarioId', removeResponsableFromProceso);

// PUT /api/procesos/:procesoId/responsables
router.put('/:procesoId/responsables', updateResponsablesProceso);

export default router;

