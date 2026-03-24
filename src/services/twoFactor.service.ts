import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { Request } from 'express';
import prisma from '../prisma';

/**
 * Servicio para gestionar autenticación de dos factores (2FA)
 * Utiliza TOTP (Time-based One-Time Password) compatible con Google Authenticator
 */
export class TwoFactorService {
  private static readonly APP_NAME = 'Gestión de Riesgos';
  private static readonly RECOVERY_CODES_COUNT = 10;
  private static readonly TOTP_WINDOW = 1; // Ventana de ±30 segundos

  /**
   * Genera un secret para TOTP y su código QR
   * @param email Email del usuario para identificar en Google Authenticator
   * @returns Secret base32 y URL del código QR
   */
  static async generateSecret(email: string): Promise<{ secret: string; qrCodeUrl: string }> {
    // Generar secret usando speakeasy
    const secret = speakeasy.generateSecret({
      name: `${this.APP_NAME} (${email})`,
      issuer: this.APP_NAME,
      length: 32
    });

    if (!secret.base32) {
      throw new Error('Error al generar secret para 2FA');
    }

    // Generar código QR
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32,
      qrCodeUrl
    };
  }

  /**
   * Verifica un código TOTP
   * @param secret Secret del usuario (base32)
   * @param token Código de 6 dígitos ingresado por el usuario
   * @returns true si el código es válido
   */
  static verifyToken(secret: string, token: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: this.TOTP_WINDOW // Permite ±30 segundos de diferencia
      });
    } catch (error) {
      console.error('[2FA] Error al verificar token:', error);
      return false;
    }
  }

  /**
   * Genera códigos de respaldo hasheados
   * @param count Cantidad de códigos a generar (default: 10)
   * @returns Array de códigos en formato XXXX-XXXX
   */
  static generateRecoveryCodes(count: number = this.RECOVERY_CODES_COUNT): { plain: string[]; hashed: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generar código aleatorio de 8 caracteres alfanuméricos
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
      
      plainCodes.push(formatted);
      
      // Hashear el código antes de guardarlo
      const hashed = crypto
        .createHash('sha256')
        .update(formatted)
        .digest('hex');
      
      hashedCodes.push(hashed);
    }

    return { plain: plainCodes, hashed: hashedCodes };
  }

  /**
   * Verifica un código de respaldo
   * @param hashedCodes Array de códigos hasheados guardados en BD
   * @param inputCode Código ingresado por el usuario
   * @returns Índice del código si es válido, -1 si no
   */
  static verifyRecoveryCode(hashedCodes: string[], inputCode: string): number {
    const inputHash = crypto
      .createHash('sha256')
      .update(inputCode.trim().toUpperCase())
      .digest('hex');

    return hashedCodes.findIndex(hash => hash === inputHash);
  }

  /**
   * Marca un código de respaldo como usado
   * @param usuarioId ID del usuario
   * @param codeIndex Índice del código usado
   */
  static async markRecoveryCodeAsUsed(usuarioId: number, codeIndex: number): Promise<void> {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { recoveryCodes: true }
    });

    if (!usuario || !usuario.recoveryCodes) {
      throw new Error('Usuario no encontrado o sin códigos de respaldo');
    }

    // Remover el código usado del array
    const updatedCodes = usuario.recoveryCodes.filter((_, index) => index !== codeIndex);

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        recoveryCodes: updatedCodes,
        twoFactorBackupUsed: { increment: 1 }
      }
    });
  }

  /**
   * Genera un fingerprint único del dispositivo
   * @param req Request de Express
   * @returns Hash único del dispositivo
   */
  static generateDeviceFingerprint(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    const fingerprint = `${userAgent}|${ip}|${acceptLanguage}|${acceptEncoding}`;
    
    return crypto
      .createHash('sha256')
      .update(fingerprint)
      .digest('hex');
  }

  /**
   * Extrae información del dispositivo desde el User-Agent
   * @param userAgent String del User-Agent
   * @returns Información del navegador y sistema operativo
   */
  static parseUserAgent(userAgent: string): { navegador: string; sistemaOperativo: string } {
    let navegador = 'Desconocido';
    let sistemaOperativo = 'Desconocido';

    // Detectar navegador
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      navegador = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      navegador = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      navegador = 'Safari';
    } else if (userAgent.includes('Edg')) {
      navegador = 'Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      navegador = 'Opera';
    }

    // Detectar sistema operativo
    if (userAgent.includes('Windows')) {
      sistemaOperativo = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      sistemaOperativo = 'macOS';
    } else if (userAgent.includes('Linux')) {
      sistemaOperativo = 'Linux';
    } else if (userAgent.includes('Android')) {
      sistemaOperativo = 'Android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      sistemaOperativo = 'iOS';
    }

    return { navegador, sistemaOperativo };
  }

  /**
   * Verifica si un dispositivo es confiable y está activo
   * @param usuarioId ID del usuario
   * @param fingerprint Fingerprint del dispositivo
   * @returns true si el dispositivo es confiable y no ha expirado
   */
  static async isDeviceTrusted(usuarioId: number, fingerprint: string): Promise<boolean> {
    const dispositivo = await prisma.dispositivoConfiable.findUnique({
      where: {
        usuarioId_deviceFingerprint: {
          usuarioId,
          deviceFingerprint: fingerprint
        }
      }
    });

    if (!dispositivo || !dispositivo.activo) {
      return false;
    }

    // Verificar si no ha expirado
    if (dispositivo.expiresAt < new Date()) {
      // Marcar como inactivo
      await prisma.dispositivoConfiable.update({
        where: { id: dispositivo.id },
        data: { activo: false }
      });
      return false;
    }

    // Actualizar última vez usado
    await prisma.dispositivoConfiable.update({
      where: { id: dispositivo.id },
      data: { lastUsedAt: new Date() }
    });

    return true;
  }

  /**
   * Registra un dispositivo como confiable
   * @param usuarioId ID del usuario
   * @param req Request de Express
   * @param dias Días de validez (default: 30)
   */
  static async trustDevice(usuarioId: number, req: Request, dias: number = 30): Promise<void> {
    const fingerprint = this.generateDeviceFingerprint(req);
    const userAgent = req.headers['user-agent'] || '';
    const { navegador, sistemaOperativo } = this.parseUserAgent(userAgent);
    const ipAddress = req.ip || req.socket.remoteAddress || '';

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dias);

    const deviceName = `${navegador} en ${sistemaOperativo}`;

    await prisma.dispositivoConfiable.upsert({
      where: {
        usuarioId_deviceFingerprint: {
          usuarioId,
          deviceFingerprint: fingerprint
        }
      },
      create: {
        usuarioId,
        deviceFingerprint: fingerprint,
        deviceName,
        ipAddress,
        userAgent,
        navegador,
        sistemaOperativo,
        expiresAt,
        activo: true
      },
      update: {
        expiresAt,
        lastUsedAt: new Date(),
        activo: true,
        ipAddress,
        userAgent
      }
    });
  }

  /**
   * Registra un evento de autenticación en la auditoría
   * @param data Datos del evento
   */
  static async logAuthEvent(data: {
    usuarioId?: number;
    email: string;
    evento: string;
    exitoso: boolean;
    metodo?: string;
    ipAddress?: string;
    userAgent?: string;
    detalles?: any;
  }): Promise<void> {
    try {
      await prisma.auditoriaAutenticacion.create({
        data: {
          usuarioId: data.usuarioId,
          email: data.email,
          evento: data.evento,
          exitoso: data.exitoso,
          metodo: data.metodo,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          detalles: data.detalles
        }
      });
    } catch (error) {
      console.error('[2FA] Error al registrar evento de auditoría:', error);
    }
  }

  /**
   * Obtiene la configuración global de 2FA
   * @returns Configuración de 2FA
   */
  static async getGlobalConfig(): Promise<{
    habilitado: boolean;
    obligatorio: boolean;
    ventanaTiempo: number;
    maxIntentos: number;
    diasDispositivos: number;
  }> {
    const configs = await prisma.configuracionSistema.findMany({
      where: {
        clave: {
          in: [
            '2fa_habilitado_global',
            '2fa_obligatorio',
            '2fa_ventana_tiempo',
            '2fa_max_intentos',
            '2fa_dispositivos_confiables_dias'
          ]
        }
      }
    });

    const configMap = configs.reduce((acc, config) => {
      acc[config.clave] = config.valor;
      return acc;
    }, {} as Record<string, string>);

    return {
      habilitado: configMap['2fa_habilitado_global'] === 'true',
      obligatorio: configMap['2fa_obligatorio'] === 'true',
      ventanaTiempo: parseInt(configMap['2fa_ventana_tiempo'] || '30'),
      maxIntentos: parseInt(configMap['2fa_max_intentos'] || '5'),
      diasDispositivos: parseInt(configMap['2fa_dispositivos_confiables_dias'] || '30')
    };
  }

  /**
   * Actualiza la configuración global de 2FA
   * @param config Configuración a actualizar
   */
  static async updateGlobalConfig(config: {
    habilitado?: boolean;
    obligatorio?: boolean;
  }): Promise<void> {
    const updates: Array<{ clave: string; valor: string }> = [];

    if (config.habilitado !== undefined) {
      updates.push({
        clave: '2fa_habilitado_global',
        valor: config.habilitado.toString()
      });
    }

    if (config.obligatorio !== undefined) {
      updates.push({
        clave: '2fa_obligatorio',
        valor: config.obligatorio.toString()
      });
    }

    for (const update of updates) {
      await prisma.configuracionSistema.update({
        where: { clave: update.clave },
        data: { valor: update.valor, updatedAt: new Date() }
      });
    }
  }

  /**
   * Limpia dispositivos confiables expirados
   * @returns Cantidad de dispositivos marcados como inactivos
   */
  static async cleanExpiredDevices(): Promise<number> {
    const result = await prisma.dispositivoConfiable.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        activo: true
      },
      data: { activo: false }
    });

    return result.count;
  }
}

export default TwoFactorService;
