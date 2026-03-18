import { Router } from 'express';
import { login, getMe, updateMe } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation';

const router = Router();

router.post(
  '/login',
  validateBody({
    username: { required: true, type: 'string', minLength: 3, maxLength: 150 },
    password: { required: true, type: 'string', minLength: 3, maxLength: 200 },
  }),
  login
);
router.get('/me', getMe);
router.patch(
  '/me',
  validateBody({
    nombre: { required: false, type: 'string', maxLength: 200 },
    passwordActual: { required: false, type: 'string', minLength: 3, maxLength: 200 },
    passwordNueva: { required: false, type: 'string', minLength: 8, maxLength: 200 },
    fotoPerfil: { required: false, type: 'string', allowEmpty: true, maxLength: 2048 },
  }),
  updateMe
);

export default router;
