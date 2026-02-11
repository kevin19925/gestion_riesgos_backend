import { Router } from 'express';
import { getAreas, getAreaById, createArea, updateArea, deleteArea } from '../controllers/areas.controller';

const router = Router();

router.get('/', getAreas);
router.get('/:id', getAreaById);
router.post('/', createArea);
router.put('/:id', updateArea);
router.delete('/:id', deleteArea);

export default router;
