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
import rolesRoutes from './roles.routes';
import controlesRoutes from './controles.routes';
import incidenciasRoutes from './incidencias.routes';
import planesAccionRoutes from './planes-accion.routes';
import dofaRoutes from './dofa.routes';
import normatividadRoutes from './normatividad.routes';
import contextoRoutes from './contexto.routes';
import uploadRoutes from './upload.routes';
import procesoResponsablesRoutes from './proceso-responsables.routes';
import calificacionInherenteRoutes from './calificacion-inherente.routes';
import configuracionResidualRoutes from './configuracionResidual.routes';
import debugRoutes from './debug.routes';
import auditRoutes from './audit.routes';
import iaRoutes from './ia.routes';

const router = Router();

// Health Check (incluye prueba de conexión a DB para diagnosticar 500 en producción)
router.get('/health', async (_req, res) => {
    let db = false;
    try {
        const prisma = (await import('../prisma')).default;
        await prisma.$queryRaw`SELECT 1`;
        db = true;
    } catch (e: any) {
        console.error('[health] DB check failed:', e?.message ?? e);
    }
    const status = db ? 'ok' : 'degraded';
    res.status(db ? 200 : 503).json({
        status,
        db,
        uptime: process.uptime(),
        version: '2.0.1-debug',
        timestamp: new Date().toISOString(),
    });
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
router.use('/roles', rolesRoutes);

// New Routes - Risk Management
router.use('/controles', controlesRoutes);
router.use('/incidencias', incidenciasRoutes);
router.use('/planes-accion', planesAccionRoutes);
router.use('/dofa', dofaRoutes);
router.use('/normatividad', normatividadRoutes);
router.use('/contexto', contextoRoutes);
router.use('/upload', uploadRoutes);
router.use('/procesos', procesoResponsablesRoutes);
router.use('/calificacion-inherente', calificacionInherenteRoutes);
router.use('/configuracion-residual', configuracionResidualRoutes);
router.use('/debug', debugRoutes); // TEMPORAL - Eliminar en producción
router.use('/audit', auditRoutes); // Sistema de auditoría
router.use('/ia', iaRoutes); // IA (Responses API + Mongo)

export default router;
