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
import controlRiesgoRoutes from './control-riesgo.routes';
import incidenciasRoutes from './incidencias.routes';
import planesAccionRoutes from './planes-accion.routes';
import planTrazabilidadRoutes from './plan-trazabilidad.routes';
import cronRoutes from './cron.routes';
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
import reunionesIndividualRoutes from './reuniones-individual.routes';
import auth2FARoutes from './auth-2fa.routes';
import admin2FARoutes from './admin-2fa.routes';
import medidasAdministracionRoutes from './medidas-administracion.routes';

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
router.use('/auth/2fa', auth2FARoutes); // Rutas de 2FA para usuarios
router.use('/admin/2fa', admin2FARoutes); // Rutas de administración de 2FA
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
router.use('/controles-riesgo', controlRiesgoRoutes); // Controles normalizados (tabla ControlRiesgo)
router.use('/incidencias', incidenciasRoutes);
router.use('/', planTrazabilidadRoutes); // Rutas de trazabilidad de planes (causas/:id/plan/*, alertas/*, planes-accion/alertas-vencimiento) - DEBE IR ANTES
router.use('/planes-accion', planesAccionRoutes);
router.use('/cron', cronRoutes); // Gestión de cron jobs y alertas automáticas
router.use('/dofa', dofaRoutes);
router.use('/normatividad', normatividadRoutes);
router.use('/contexto', contextoRoutes);
router.use('/upload', uploadRoutes);
router.use('/procesos', procesoResponsablesRoutes);
router.use('/calificacion-inherente', calificacionInherenteRoutes);
router.use('/configuracion-residual', configuracionResidualRoutes);
if (process.env.NODE_ENV !== 'production') {
    router.use('/debug', debugRoutes);
}
router.use('/audit', auditRoutes); // Sistema de auditoría
router.use('/ia', iaRoutes); // IA (Responses API + Mongo)
router.use('/reuniones', reunionesIndividualRoutes); // Rutas individuales de reuniones
router.use('/medidas-administracion', medidasAdministracionRoutes); // Medidas de Administración para riesgos positivos

export default router;
