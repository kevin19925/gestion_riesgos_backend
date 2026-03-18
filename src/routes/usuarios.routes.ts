import { Router } from 'express';
import { getUsuarios, getUsuarioById, createUsuario, updateUsuario, deleteUsuario } from '../controllers/usuarios.controller';
import { requireRoles } from '../middleware/auth';
import { validateBody, validateNumericIdParam } from '../middleware/validation';

const router = Router();

router.get('/', requireRoles(['admin']), getUsuarios);
router.get('/:id', requireRoles(['admin']), validateNumericIdParam('id'), getUsuarioById);
router.post(
  '/',
  requireRoles(['admin']),
  validateBody({
    nombre: { required: true, type: 'string', minLength: 2, maxLength: 200 },
    email: { required: true, type: 'string', minLength: 5, maxLength: 200 },
    password: { required: false, type: 'string', minLength: 8, maxLength: 200 },
  }),
  createUsuario
);
router.put(
  '/:id',
  requireRoles(['admin']),
  validateNumericIdParam('id'),
  validateBody({
    nombre: { required: false, type: 'string', minLength: 2, maxLength: 200 },
    email: { required: false, type: 'string', minLength: 5, maxLength: 200 },
    password: { required: false, type: 'string', minLength: 8, maxLength: 200 },
  }),
  updateUsuario
);
router.delete('/:id', requireRoles(['admin']), validateNumericIdParam('id'), deleteUsuario);

export default router;
