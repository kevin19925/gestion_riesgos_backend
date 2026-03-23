import { Router } from 'express';
import {
  cambiarEstadoPlan,
  convertirPlanAControl,
  obtenerTrazabilidadPlan,
  obtenerAlertasVencimiento,
  marcarAlertaLeida,
  obtenerPlanesAccion
} from '../controllers/plan-trazabilidad.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const auth = authMiddleware({ required: true });

// Ruta de prueba
router.get('/test-auth', auth, (req, res) => {
  res.json({ message: 'Auth funciona', user: (req as any).user });
});

// Rutas de planes (listado general)
router.get('/planes-accion', auth, obtenerPlanesAccion);

// Rutas de planes (en causas)
router.put('/causas/:id/plan/estado', auth, cambiarEstadoPlan);
router.post('/causas/:id/plan/convertir-a-control', auth, convertirPlanAControl);
router.get('/causas/:id/plan/trazabilidad', auth, obtenerTrazabilidadPlan);

// Rutas de alertas
router.get('/alertas-vencimiento', auth, obtenerAlertasVencimiento);
router.put('/alertas/:id/marcar-leida', auth, marcarAlertaLeida);

export default router;
