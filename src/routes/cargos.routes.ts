import { Router } from 'express';
import { getCargos, getCargoById, createCargo, updateCargo, deleteCargo } from '../controllers/cargos.controller';

const router = Router();

router.get('/', getCargos);
router.get('/:id', getCargoById);
router.post('/', createCargo);
router.put('/:id', updateCargo);
router.delete('/:id', deleteCargo);

export default router;
