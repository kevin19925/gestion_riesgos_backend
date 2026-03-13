import { Router } from 'express';
import { 
  postChatIA, 
  postChatIAStream,
  getConversaciones, 
  getConversacionDetail, 
  deleteConversacion, 
  renameConversacion 
} from '../controllers/ia.controller';

const router = Router();

// Chat IA principal: requiere JWT (authMiddleware ya está aplicado a nivel de app)
router.post('/chat', postChatIA);
router.post('/chat-stream', postChatIAStream);

router.get('/conversaciones', getConversaciones);
router.get('/conversaciones/:id', getConversacionDetail);
router.delete('/conversaciones/:id', deleteConversacion);
router.put('/conversaciones/:id', renameConversacion);

export default router;

