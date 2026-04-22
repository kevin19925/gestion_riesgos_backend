import { Router } from 'express';
import { requireRoles } from '../middleware/auth';
import {
  getConfiguracionResidualEstrategica,
  putConfiguracionResidualEstrategica,
  postRecalcularResidualEstrategico,
} from '../controllers/configuracionResidualEstrategica.controller';

const router = Router();

router.get(
  '/',
  requireRoles(['admin', 'supervisor_riesgos', 'dueño_procesos', 'gerente_general']),
  getConfiguracionResidualEstrategica
);
router.put('/', requireRoles(['admin']), putConfiguracionResidualEstrategica);
router.post('/recalcular', requireRoles(['admin']), postRecalcularResidualEstrategico);

export default router;
