import { Router } from 'express';
import {
    getObservaciones, createObservacion,
    getHistorial,
} from '../controllers/utilidades.controller';

const router = Router();

router.get('/observaciones', getObservaciones);
router.post('/observaciones', createObservacion);

router.get('/historial', getHistorial);

export default router;
