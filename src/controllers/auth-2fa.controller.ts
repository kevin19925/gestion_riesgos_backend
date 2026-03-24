import { Request, Response } from 'express';
import prisma from '../prisma';
import TwoFactorService from '../services/twoFactor.service';

/**
 * Controlador para gestionar autenticación de dos factores (2FA)
 */

/**
 * POST /api/auth/2fa/setup
 * Genera secret y código QR para configurar 2FA
 */
export const setup2FA = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true, twoFactorEnabled: true }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (usuario.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA ya está activado' });
    }

    // Generar secret y QR
    const { secret, qrCodeUrl } = await TwoFactorService.generateSecret(usuario.email);

    // Guardar secret temporalmente (no activar aún)
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { twoFactorSecret: secret }
    });

    // Registrar evento
    await TwoFactorService.logAuthEvent({
      usuarioId,
      email: usuario.email,
      evento: '2fa_setup_initiated',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      secret,
      qrCodeUrl,
      message: 'Escanea el código QR con Google Authenticator'
    });
  } catch (error) {
    console.error('[2FA Setup] Error:', error);
    res.status(500).json({ error: 'Error al configurar 2FA' });
  }
};

/**
 * POST /api/auth/2fa/verify-setup
 * Verifica el código inicial y genera códigos de respaldo
 */
export const verifySetup2FA = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;
    const { token } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!token || token.length !== 6) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true, twoFactorSecret: true, twoFactorEnabled: true }
    });

    if (!usuario || !usuario.twoFactorSecret) {
      return res.status(400).json({ error: 'Primero debes iniciar la configuración de 2FA' });
    }

    if (usuario.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA ya está activado' });
    }

    // Verificar código
    const isValid = TwoFactorService.verifyToken(usuario.twoFactorSecret, token);

    if (!isValid) {
      await TwoFactorService.logAuthEvent({
        usuarioId,
        email: usuario.email,
        evento: '2fa_setup_verification_failed',
        exitoso: false,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({ error: 'Código incorrecto' });
    }

    // Generar códigos de respaldo
    const { plain, hashed } = TwoFactorService.generateRecoveryCodes();

    // Activar 2FA y guardar códigos
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        twoFactorEnabled: true,
        recoveryCodes: hashed
      }
    });

    // Registrar evento
    await TwoFactorService.logAuthEvent({
      usuarioId,
      email: usuario.email,
      evento: '2fa_enabled',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      recoveryCodes: plain,
      message: '2FA activado correctamente. Guarda estos códigos de respaldo en un lugar seguro.'
    });
  } catch (error) {
    console.error('[2FA Verify Setup] Error:', error);
    res.status(500).json({ error: 'Error al verificar configuración de 2FA' });
  }
};

/**
 * POST /api/auth/2fa/disable
 * Desactiva 2FA para el usuario actual
 */
export const disable2FA = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;
    const { password } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Se requiere contraseña para desactivar 2FA' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true, password: true, twoFactorEnabled: true }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!usuario.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA no está activado' });
    }

    // Verificar contraseña
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, usuario.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Desactivar 2FA
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: [],
        twoFactorBackupUsed: 0
      }
    });

    // Eliminar dispositivos confiables
    await prisma.dispositivoConfiable.deleteMany({
      where: { usuarioId }
    });

    // Registrar evento
    await TwoFactorService.logAuthEvent({
      usuarioId,
      email: usuario.email,
      evento: '2fa_disabled',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: '2FA desactivado correctamente'
    });
  } catch (error) {
    console.error('[2FA Disable] Error:', error);
    res.status(500).json({ error: 'Error al desactivar 2FA' });
  }
};

/**
 * POST /api/auth/2fa/verify-login
 * Verifica código 2FA durante el login
 */
export const verifyLogin2FA = async (req: Request, res: Response) => {
  try {
    const { email, token, trustDevice } = req.body;

    if (!email || !token) {
      return res.status(400).json({ error: 'Email y código son requeridos' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
        recoveryCodes: true
      }
    });

    if (!usuario || !usuario.twoFactorEnabled || !usuario.twoFactorSecret) {
      return res.status(400).json({ error: 'Usuario no encontrado o 2FA no configurado' });
    }

    let isValid = false;
    let metodo = 'totp';

    // Verificar si es código TOTP o código de respaldo
    if (token.includes('-')) {
      // Es un código de respaldo
      const codeIndex = TwoFactorService.verifyRecoveryCode(usuario.recoveryCodes || [], token);
      
      if (codeIndex >= 0) {
        isValid = true;
        metodo = 'recovery_code';
        
        // Marcar código como usado
        await TwoFactorService.markRecoveryCodeAsUsed(usuario.id, codeIndex);
      }
    } else {
      // Es un código TOTP
      isValid = TwoFactorService.verifyToken(usuario.twoFactorSecret, token);
    }

    if (!isValid) {
      await TwoFactorService.logAuthEvent({
        usuarioId: usuario.id,
        email: usuario.email,
        evento: '2fa_login_failed',
        exitoso: false,
        metodo,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({ error: 'Código incorrecto' });
    }

    // Si el usuario quiere confiar en este dispositivo
    if (trustDevice) {
      await TwoFactorService.trustDevice(usuario.id, req);
    }

    // Registrar evento exitoso
    await TwoFactorService.logAuthEvent({
      usuarioId: usuario.id,
      email: usuario.email,
      evento: '2fa_login_success',
      exitoso: true,
      metodo,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      detalles: { trustDevice }
    });

    res.json({
      success: true,
      message: 'Verificación 2FA exitosa'
    });
  } catch (error) {
    console.error('[2FA Verify Login] Error:', error);
    res.status(500).json({ error: 'Error al verificar código 2FA' });
  }
};

/**
 * POST /api/auth/2fa/regenerate-recovery
 * Regenera códigos de respaldo
 */
export const regenerateRecoveryCodes = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;
    const { password } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Se requiere contraseña' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true, password: true, twoFactorEnabled: true }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!usuario.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA no está activado' });
    }

    // Verificar contraseña
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, usuario.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Generar nuevos códigos
    const { plain, hashed } = TwoFactorService.generateRecoveryCodes();

    // Actualizar códigos
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        recoveryCodes: hashed,
        twoFactorBackupUsed: 0
      }
    });

    // Registrar evento
    await TwoFactorService.logAuthEvent({
      usuarioId,
      email: usuario.email,
      evento: '2fa_recovery_codes_regenerated',
      exitoso: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      recoveryCodes: plain,
      message: 'Códigos de respaldo regenerados. Los anteriores ya no son válidos.'
    });
  } catch (error) {
    console.error('[2FA Regenerate Recovery] Error:', error);
    res.status(500).json({ error: 'Error al regenerar códigos de respaldo' });
  }
};

/**
 * GET /api/auth/2fa/status
 * Obtiene el estado de 2FA del usuario actual
 */
export const get2FAStatus = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        twoFactorEnabled: true,
        twoFactorBackupUsed: true,
        recoveryCodes: true
      }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const globalConfig = await TwoFactorService.getGlobalConfig();

    res.json({
      enabled: usuario.twoFactorEnabled,
      backupCodesRemaining: (usuario.recoveryCodes || []).length,
      backupCodesUsed: usuario.twoFactorBackupUsed,
      globalConfig: {
        habilitado: globalConfig.habilitado,
        obligatorio: globalConfig.obligatorio
      }
    });
  } catch (error) {
    console.error('[2FA Status] Error:', error);
    res.status(500).json({ error: 'Error al obtener estado de 2FA' });
  }
};

/**
 * GET /api/auth/2fa/trusted-devices
 * Obtiene lista de dispositivos confiables del usuario
 */
export const getTrustedDevices = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const dispositivos = await prisma.dispositivoConfiable.findMany({
      where: { usuarioId, activo: true },
      select: {
        id: true,
        deviceName: true,
        navegador: true,
        sistemaOperativo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true
      },
      orderBy: { lastUsedAt: 'desc' }
    });

    res.json({ dispositivos });
  } catch (error) {
    console.error('[2FA Trusted Devices] Error:', error);
    res.status(500).json({ error: 'Error al obtener dispositivos confiables' });
  }
};

/**
 * DELETE /api/auth/2fa/trusted-devices/:id
 * Revoca un dispositivo confiable
 */
export const revokeTrustedDevice = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.id;
    const deviceId = parseInt(req.params.id);

    if (!usuarioId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (isNaN(deviceId)) {
      return res.status(400).json({ error: 'ID de dispositivo inválido' });
    }

    // Verificar que el dispositivo pertenece al usuario
    const dispositivo = await prisma.dispositivoConfiable.findFirst({
      where: { id: deviceId, usuarioId }
    });

    if (!dispositivo) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    // Marcar como inactivo
    await prisma.dispositivoConfiable.update({
      where: { id: deviceId },
      data: { activo: false }
    });

    res.json({
      success: true,
      message: 'Dispositivo revocado correctamente'
    });
  } catch (error) {
    console.error('[2FA Revoke Device] Error:', error);
    res.status(500).json({ error: 'Error al revocar dispositivo' });
  }
};
