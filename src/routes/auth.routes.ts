import { Router } from 'express';
import { login, getMe, updateMe } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.get('/me', getMe);
router.patch('/me', updateMe);

export default router;
