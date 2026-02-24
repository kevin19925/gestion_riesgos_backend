import { Router } from 'express';
import {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
} from '../controllers/roles.controller';

const router = Router();

router.get('/', getRoles);
router.get('/:id', getRoleById);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;

