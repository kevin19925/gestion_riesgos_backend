import { Router } from 'express';
import {
    getObservaciones, createObservacion,
    getHistorial,
    getTareas, createTarea,
    getNotificaciones
} from '../controllers/utilidades.controller';

const router = Router();

router.get('/observaciones', getObservaciones);
router.post('/observaciones', createObservacion);

router.get('/historial', getHistorial);

router.get('/tareas', getTareas);
router.post('/tareas', createTarea);

router.get('/notificaciones', getNotificaciones);

export default router;
