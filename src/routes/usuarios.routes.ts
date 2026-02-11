import { Router } from 'express';
import { getUsuarios, getUsuarioById } from '../controllers/usuarios.controller';

const router = Router();

router.get('/', getUsuarios);
router.get('/:id', getUsuarioById);

export default router;
