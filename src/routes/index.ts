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
import controlesRoutes from './controles.routes';
import incidenciasRoutes from './incidencias.routes';
import planesAccionRoutes from './planes-accion.routes';
import benchmarkingRoutes from './benchmarking.routes';
import dofaRoutes from './dofa.routes';
import normatividadRoutes from './normatividad.routes';
import contextoRoutes from './contexto.routes';

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

// New Routes - Risk Management
router.use('/controles', controlesRoutes);
router.use('/incidencias', incidenciasRoutes);
router.use('/planes-accion', planesAccionRoutes);
router.use('/benchmarking', benchmarkingRoutes);
router.use('/dofa', dofaRoutes);
router.use('/normatividad', normatividadRoutes);
router.use('/contexto', contextoRoutes);

export default router;
