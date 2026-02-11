import { Router } from 'express';
import procesosRoutes from './procesos.routes';
import riesgosRoutes from './riesgos.routes';
import evaluacionesRoutes from './evaluaciones.routes';
import catalogosRoutes from './catalogos.routes';
import priorizacionesRoutes from './priorizaciones.routes';
import authRoutes from './auth.routes';
import usuariosRoutes from './usuarios.routes';
import utilidadesRoutes from './utilidades.routes';
import areasRoutes from './areas.routes';
import cargosRoutes from './cargos.routes';
import gerenciasRoutes from './gerencias.routes';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Auth Routes
router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/utilidades', utilidadesRoutes);

// Domain Routes
router.use('/procesos', procesosRoutes);
router.use('/riesgos', riesgosRoutes);
router.use('/evaluaciones', evaluacionesRoutes);
router.use('/catalogos', catalogosRoutes);
router.use('/priorizaciones', priorizacionesRoutes);
router.use('/areas', areasRoutes);
router.use('/cargos', cargosRoutes);
router.use('/gerencias', gerenciasRoutes);

export default router;
