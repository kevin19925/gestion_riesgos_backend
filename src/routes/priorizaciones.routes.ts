import { Router } from 'express';
import { getPriorizaciones, createPriorizacion } from '../controllers/priorizaciones.controller';

const router = Router();

router.get('/', getPriorizaciones);
router.post('/', createPriorizacion);

export default router;
