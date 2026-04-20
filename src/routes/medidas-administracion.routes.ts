import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  obtenerMedidasPorCausa,
  crearMedida,
  actualizarMedida,
  eliminarMedida,
} from '../controllers/medidas-administracion.controller';

const router = Router();

// Aplicar autenticación a todas las rutas de medidas
const auth = authMiddleware({ required: true });

// GET  /api/medidas-administracion?causaRiesgoId=X
router.get('/', auth, obtenerMedidasPorCausa);

// POST /api/medidas-administracion
router.post('/', auth, crearMedida);

// PUT  /api/medidas-administracion/:id
router.put('/:id', auth, actualizarMedida);

// DELETE /api/medidas-administracion/:id
router.delete('/:id', auth, eliminarMedida);

export default router;
