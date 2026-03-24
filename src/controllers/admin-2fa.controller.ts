import { Request, Response } from 'express';
import prisma from '../prisma';
import TwoFactorService from '../services/twoFactor.service';

/**
 * Controlador para administración de 2FA (solo administradores)
 */

/**
 * GET /api/admin/2fa/config
 * Obtiene la configuración global de 2FA
 */
export const getGlobalConfig = async (req: Request, res: Response) => {
  try {
    const config = await TwoFactorService.getGlobalConfig();
    res.json(config);
  } catch (error) {
    console.error('[Admin 2FA Config] Error:', error);
    res.status(500).json({ error: 'Error al obtener configuración de 2FA' });
  }
};

/**
 * PUT /api/admin/2fa/config
 * Actualiza la configuración global de 2FA
 */
export const updateGlobalConfig = async (req: Request, res: Response) => {
  try {
    const { habilitado, obligatorio } = req.body;
    const adminId = (req as any).user?.id;
    const adminEmail = (req as any).user?.email;

    if (habilitado === undefined && obligatorio === undefined) {
      return res.status(400).json({ error: 'No se proporcionaron cambios' });
    }

    await TwoFactorService.updateGlobalConfig({ habilitado, obligatorio });

    // Registrar evento
    await TwoFactorService.logAuthEvent({
      usuarioId: adminId,
      email: adminEmail || 'admin',
      evento: '2fa_global_config_updated',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      detalles: { habilitado, obligatorio }
    });

    res.json({
      success: true,
      message: 'Configuración actualizada correctamente'
    });
  } catch (error) {
    console.error('[Admin 2FA Update Config] Error:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de 2FA' });
  }
};

/**
 * GET /api/admin/2fa/users
 * Obtiene lista de usuarios con 2FA activo
 */
export const getUsersWith2FA = async (req: Request, res: Response) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { twoFactorEnabled: true },
      select: {
        id: true,
        nombre: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorBackupUsed: true,
        recoveryCodes: true,
        createdAt: true,
        updatedAt: true,
        roleRelacion: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    const usuariosFormatted = usuarios.map(u => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      role: u.roleRelacion.nombre,
      twoFactorEnabled: u.twoFactorEnabled,
      backupCodesRemaining: (u.recoveryCodes || []).length,
      backupCodesUsed: u.twoFactorBackupUsed,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    res.json({ usuarios: usuariosFormatted });
  } catch (error) {
    console.error('[Admin 2FA Users] Error:', error);
    res.status(500).json({ error: 'Error al obtener usuarios con 2FA' });
  }
};

/**
 * POST /api/admin/2fa/force-disable/:userId
 * Desactiva 2FA de un usuario específico (emergencia)
 */
export const forceDisable2FA = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const adminId = (req as any).user?.id;
    const adminEmail = (req as any).user?.email;
    const { razon } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { email: true, nombre: true, twoFactorEnabled: true }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!usuario.twoFactorEnabled) {
      return res.status(400).json({ error: 'El usuario no tiene 2FA activado' });
    }

    // Desactivar 2FA
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: [],
        twoFactorBackupUsed: 0
      }
    });

    // Eliminar dispositivos confiables
    await prisma.dispositivoConfiable.deleteMany({
      where: { usuarioId: userId }
    });

    // Registrar evento en auditoría del usuario afectado
    await TwoFactorService.logAuthEvent({
      usuarioId: userId,
      email: usuario.email,
      evento: '2fa_force_disabled_by_admin',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      detalles: {
        adminId,
        adminEmail,
        razon: razon || 'No especificada'
      }
    });

    // Registrar evento en auditoría del admin
    await TwoFactorService.logAuthEvent({
      usuarioId: adminId,
      email: adminEmail || 'admin',
      evento: '2fa_admin_force_disable',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      detalles: {
        targetUserId: userId,
        targetUserEmail: usuario.email,
        razon: razon || 'No especificada'
      }
    });

    res.json({
      success: true,
      message: `2FA desactivado para ${usuario.nombre} (${usuario.email})`
    });
  } catch (error) {
    console.error('[Admin 2FA Force Disable] Error:', error);
    res.status(500).json({ error: 'Error al desactivar 2FA del usuario' });
  }
};

/**
 * GET /api/admin/2fa/audit
 * Obtiene logs de auditoría de eventos 2FA
 */
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, evento, email, exitoso } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (evento) {
      where.evento = evento;
    }

    if (email) {
      where.email = { contains: email as string, mode: 'insensitive' };
    }

    if (exitoso !== undefined) {
      where.exitoso = exitoso === 'true';
    }

    const [logs, total] = await Promise.all([
      prisma.auditoriaAutenticacion.findMany({
        where,
        include: {
          usuario: {
            select: {
              nombre: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.auditoriaAutenticacion.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('[Admin 2FA Audit] Error:', error);
    res.status(500).json({ error: 'Error al obtener logs de auditoría' });
  }
};

/**
 * GET /api/admin/2fa/stats
 * Obtiene estadísticas de uso de 2FA
 */
export const get2FAStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsuarios,
      usuariosCon2FA,
      dispositivosConfiables,
      eventosUltimos30Dias
    ] = await Promise.all([
      prisma.usuario.count({ where: { activo: true } }),
      prisma.usuario.count({ where: { twoFactorEnabled: true, activo: true } }),
      prisma.dispositivoConfiable.count({ where: { activo: true } }),
      prisma.auditoriaAutenticacion.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Eventos por tipo en los últimos 30 días
    const eventosPorTipo = await prisma.auditoriaAutenticacion.groupBy({
      by: ['evento'],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    // Intentos fallidos en los últimos 7 días
    const intentosFallidos = await prisma.auditoriaAutenticacion.count({
      where: {
        exitoso: false,
        evento: { in: ['2fa_login_failed', '2fa_setup_verification_failed'] },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    const config = await TwoFactorService.getGlobalConfig();

    res.json({
      usuarios: {
        total: totalUsuarios,
        con2FA: usuariosCon2FA,
        porcentaje: totalUsuarios > 0 ? ((usuariosCon2FA / totalUsuarios) * 100).toFixed(2) : 0
      },
      dispositivosConfiables,
      eventos: {
        ultimos30Dias: eventosUltimos30Dias,
        porTipo: eventosPorTipo.map(e => ({
          evento: e.evento,
          cantidad: e._count
        }))
      },
      intentosFallidos7Dias: intentosFallidos,
      configuracion: config
    });
  } catch (error) {
    console.error('[Admin 2FA Stats] Error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de 2FA' });
  }
};

/**
 * POST /api/admin/2fa/clean-expired-devices
 * Limpia dispositivos confiables expirados
 */
export const cleanExpiredDevices = async (req: Request, res: Response) => {
  try {
    const count = await TwoFactorService.cleanExpiredDevices();

    res.json({
      success: true,
      message: `${count} dispositivos marcados como inactivos`,
      count
    });
  } catch (error) {
    console.error('[Admin 2FA Clean Devices] Error:', error);
    res.status(500).json({ error: 'Error al limpiar dispositivos expirados' });
  }
};
