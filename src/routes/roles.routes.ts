import { Router } from 'express';
import {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
} from '../controllers/roles.controller';
import { requireRoles } from '../middleware/auth';
import { validateBody, validateNumericIdParam } from '../middleware/validation';

const router = Router();

router.get('/', requireRoles(['admin']), getRoles);
router.get('/:id', requireRoles(['admin']), validateNumericIdParam('id'), getRoleById);
router.post(
    '/',
    requireRoles(['admin']),
    validateBody({
        codigo: { required: true, type: 'string', minLength: 2, maxLength: 50 },
        nombre: { required: true, type: 'string', minLength: 2, maxLength: 150 },
        descripcion: { required: false, type: 'string', maxLength: 500 },
        ambito: { required: false, type: 'string', minLength: 8, maxLength: 10 },
    }),
    createRole
);
router.put(
    '/:id',
    requireRoles(['admin']),
    validateNumericIdParam('id'),
    validateBody({
        nombre: { required: false, type: 'string', minLength: 2, maxLength: 150 },
        descripcion: { required: false, type: 'string', maxLength: 500, allowEmpty: true },
        ambito: { required: false, type: 'string', minLength: 8, maxLength: 10 },
    }),
    updateRole
);
router.delete('/:id', requireRoles(['admin']), validateNumericIdParam('id'), deleteRole);

export default router;

