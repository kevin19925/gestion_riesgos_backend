import { Router } from 'express';
import { getProcesos, getProcesoById, createProceso, updateProceso, deleteProceso, duplicateProceso, bulkUpdateProcesos } from '../controllers/procesos.controller';
import {
    getAsistentesProceso,
    asignarAsistentesProceso,
    getReuniones,
    crearReunion,
    actualizarReunion,
    eliminarReunion,
    getAsistencias,
    actualizarAsistencias
} from '../controllers/reuniones.controller';

const router = Router();

// Static routes first (before dynamic :id routes)
router.put('/bulk', bulkUpdateProcesos);
router.post('/:id/duplicate', duplicateProceso);

// TEST: Ruta de prueba simple
router.get('/test-reuniones', (req, res) => {
    res.json({ message: 'Rutas de reuniones funcionando', timestamp: new Date() });
});

// Rutas de asistentes y reuniones por proceso
router.get('/:id/asistentes', getAsistentesProceso);
router.post('/:id/asistentes', asignarAsistentesProceso);
router.get('/:id/reuniones', getReuniones);
router.post('/:id/reuniones', crearReunion);

// Dynamic routes
router.get('/', getProcesos);
router.post('/', createProceso);
router.get('/:id', getProcesoById);
router.put('/:id', updateProceso);
router.delete('/:id', deleteProceso);

export default router;
