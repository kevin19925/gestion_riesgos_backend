import { Request, Response } from 'express';
import prisma from '../prisma';
import { signToken } from '../utils/jwt';
import { hashPassword, looksHashed, verifyPassword } from '../utils/password';
import { deleteBlobByUrl, isAzureBlobConfigured } from '../utils/azureBlob';
import { redisGet, redisSet, redisDel } from '../redisClient';
import TwoFactorService from '../services/twoFactor.service';

const CACHE_TTL_ME = 60; // 1 minuto para GET /auth/me
const IS_DEV = process.env.NODE_ENV !== 'production';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    try {
        const normalizedUsername = String(username).trim();
        const normalizedPassword = String(password).trim();

        if (IS_DEV) {
            console.log('[auth/login] intento de login', {
                username: normalizedUsername,
            });
        }

        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { email: normalizedUsername },
                    { email: `${normalizedUsername}@comware.com.co` }
                ]
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                password: true,
                activo: true,
                roleId: true,
                cargoId: true,
                fotoPerfil: true,
                twoFactorEnabled: true,
                twoFactorSecret: true,
                roleRelacion: { select: { codigo: true, ambito: true, permisos: true } },
                cargo: { select: { nombre: true } }
            }
        });

        if (!user || !(await verifyPassword(normalizedPassword, (user as any).password))) {
            if (IS_DEV) {
                console.warn('[auth/login] usuario no encontrado o contraseña incorrecta', {
                    username: normalizedUsername,
                });
            }
            return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
        }

        if (!looksHashed((user as any).password)) {
            const upgradedPassword = await hashPassword(normalizedPassword);
            await prisma.usuario.update({
                where: { id: user.id },
                data: { password: upgradedPassword }
            });
        }

        if (!user.activo) {
            if (IS_DEV) {
                console.warn('[auth/login] usuario inactivo', {
                    userId: user.id,
                    email: user.email,
                });
            }
            return res.status(401).json({ success: false, error: 'Usuario inactivo' });
        }

        const roleCodigo = user.roleRelacion?.codigo || 'usuario';
        const roleAmbito = (user.roleRelacion as { ambito?: string })?.ambito || 'OPERATIVO';
        const permisos = (user.roleRelacion as { permisos?: { visualizar?: boolean; editar?: boolean } })?.permisos || {};
        const puedeVisualizar = permisos.visualizar !== false;
        const puedeEditar = permisos.editar === true;

        // ============================================
        // VERIFICACIÓN DE 2FA
        // ============================================
        
        // El administrador NO requiere 2FA (excepción)
        const esAdmin = roleCodigo === 'admin' || roleCodigo === 'ADMIN' || roleAmbito === 'SISTEMA';
        
        // Verificar si el usuario tiene 2FA activado (y no es admin)
        if (!esAdmin && user.twoFactorEnabled && user.twoFactorSecret) {
            // Verificar si el dispositivo es confiable
            const deviceFingerprint = TwoFactorService.generateDeviceFingerprint(req);
            const isTrusted = await TwoFactorService.isDeviceTrusted(user.id, deviceFingerprint);

            if (!isTrusted) {
                // Dispositivo no confiable, requiere verificación 2FA
                if (IS_DEV) {
                    console.log('[auth/login] 2FA requerido para usuario', {
                        userId: user.id,
                        email: user.email,
                    });
                }

                // Registrar evento
                await TwoFactorService.logAuthEvent({
                    usuarioId: user.id,
                    email: user.email,
                    evento: '2fa_required',
                    exitoso: true,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                });

                // Retornar indicando que se requiere 2FA
                return res.status(200).json({
                    success: false,
                    requires2FA: true,
                    email: user.email,
                    message: 'Se requiere verificación de dos factores'
                });
            }

            // Dispositivo confiable, continuar con login normal
            if (IS_DEV) {
                console.log('[auth/login] dispositivo confiable, omitiendo 2FA', {
                    userId: user.id,
                    email: user.email,
                });
            }
        }
        
        // Verificar si 2FA está habilitado globalmente pero el usuario no lo ha configurado
        if (!esAdmin && !user.twoFactorEnabled) {
            const globalConfig = await TwoFactorService.getGlobalConfig();
            
            if (globalConfig.habilitado) {
                // 2FA está habilitado globalmente, el usuario debe configurarlo
                if (IS_DEV) {
                    console.log('[auth/login] usuario debe configurar 2FA', {
                        userId: user.id,
                        email: user.email,
                    });
                }

                // Retornar indicando que debe configurar 2FA
                return res.status(200).json({
                    success: false,
                    requiresSetup2FA: true,
                    email: user.email,
                    obligatorio: globalConfig.obligatorio,
                    message: '2FA está habilitado. Debes configurarlo para continuar.'
                });
            }
        }

        // ============================================
        // LOGIN EXITOSO
        // ============================================

        if (IS_DEV) {
            console.log('[auth/login] login exitoso', {
                userId: user.id,
                email: user.email,
                roleCodigo,
                roleAmbito,
                puedeVisualizar,
                puedeEditar,
            });
        }

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: roleCodigo
        });

        // Registrar login exitoso
        await TwoFactorService.logAuthEvent({
            usuarioId: user.id,
            email: user.email,
            evento: 'login_success',
            exitoso: true,
            metodo: user.twoFactorEnabled ? 'trusted_device' : 'password',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            token,
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            user: {
                id: user.id,
                username: user.email.split('@')[0],
                email: user.email,
                fullName: user.nombre,
                role: roleCodigo,
                department: user.cargo?.nombre || 'General',
                position: user.cargo?.nombre || roleCodigo,
                esDuenoProcesos: roleCodigo === 'dueño_procesos',
                fotoPerfil: (user as { fotoPerfil?: string | null }).fotoPerfil ?? null,
                ambito: roleAmbito,
                puedeVisualizar,
                puedeEditar,
                twoFactorEnabled: user.twoFactorEnabled
            }
        });
    } catch (error: any) {
        console.error('[auth/login]', error?.message || error);
        res.status(500).json({ success: false, error: 'No se pudo iniciar sesión. Intente de nuevo.' });
    }
};

function buildMePayload(user: any): object {
    const roleCodigo = user.roleRelacion?.codigo || 'usuario';
    const roleAmbito = (user.roleRelacion as { ambito?: string })?.ambito || 'OPERATIVO';
    const permisos = (user.roleRelacion as { permisos?: { visualizar?: boolean; editar?: boolean } })?.permisos || {};
    return {
        id: user.id,
        username: user.email.split('@')[0],
        email: user.email,
        fullName: user.nombre,
        role: roleCodigo,
        department: user.cargo?.nombre || 'General',
        position: user.cargo?.nombre || roleCodigo,
        esDuenoProcesos: roleCodigo === 'dueño_procesos',
        fotoPerfil: (user as { fotoPerfil?: string | null }).fotoPerfil ?? null,
        ambito: roleAmbito,
        puedeVisualizar: permisos.visualizar !== false,
        puedeEditar: permisos.editar === true
    };
}

export const getMe = async (req: Request, res: Response) => {
    const id = (req as any).user?.userId;
    if (!id) return res.status(401).json({ error: 'No autorizado' });

    const userId = Number(id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    try {
        const cacheKey = `auth:me:${userId}`;
        const cached = await redisGet<any>(cacheKey);
        if (cached) {
            res.setHeader('Cache-Control', 'private, max-age=60');
            return res.json(cached);
        }

        const user = await prisma.usuario.findUnique({
            where: { id: userId },
            select: {
                id: true,
                nombre: true,
                email: true,
                activo: true,
                roleId: true,
                cargoId: true,
                fotoPerfil: true,
                roleRelacion: { select: { codigo: true, ambito: true, permisos: true } },
                cargo: { select: { nombre: true } }
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.activo) return res.status(403).json({ error: 'User inactive' });

        const payload = buildMePayload(user);
        try {
            await redisSet(cacheKey, payload, CACHE_TTL_ME);
        } catch (_) {
            // Si Redis falla, responder igual sin cachear
        }
        res.setHeader('Cache-Control', 'private, max-age=60');
        res.json(payload);
    } catch (error: any) {
        console.error('[auth/getMe]', error?.message ?? error);
        res.status(500).json({ error: 'No se pudo cargar el usuario. Intente de nuevo.' });
    }
};

export const updateMe = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    const { nombre, passwordActual, passwordNueva, fotoPerfil } = req.body;

    try {
        const user = await prisma.usuario.findUnique({
            where: { id: Number(userId) },
            include: { cargo: true, roleRelacion: true }
        });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!user.activo) return res.status(403).json({ error: 'Usuario inactivo' });

        const updateData: { nombre?: string; password?: string; fotoPerfil?: string | null } = {};

        if (nombre !== undefined && typeof nombre === 'string' && nombre.trim()) {
            updateData.nombre = nombre.trim();
        }

        if (passwordNueva !== undefined && passwordNueva !== '') {
            if (!passwordActual || !(await verifyPassword(String(passwordActual), user.password))) {
                return res.status(400).json({ error: 'La contraseña actual no es correcta' });
            }
            updateData.password = await hashPassword(String(passwordNueva));
        }

        if (fotoPerfil !== undefined) {
            const newFoto = fotoPerfil === '' || fotoPerfil == null ? null : String(fotoPerfil);
            const oldFoto = (user as any).fotoPerfil;
            // Borrar el blob anterior solo si es distinto al nuevo (mismo usuario = mismo nombre de blob; la subida ya lo reemplazó)
            const mismaUrl = oldFoto && newFoto && oldFoto.trim() === newFoto.trim();
            if (oldFoto && oldFoto.trim() && !mismaUrl && isAzureBlobConfigured()) {
                try {
                    await deleteBlobByUrl(oldFoto);
                } catch (e) {
                    console.warn('[auth/updateMe] No se pudo borrar la imagen anterior:', (e as Error)?.message);
                }
            }
            updateData.fotoPerfil = newFoto;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No hay datos para actualizar' });
        }

        const updated = await prisma.usuario.update({
            where: { id: Number(userId) },
            data: updateData,
            select: {
                id: true,
                nombre: true,
                email: true,
                fotoPerfil: true,
                cargo: { select: { nombre: true } },
                roleRelacion: { select: { codigo: true, ambito: true, permisos: true } }
            }
        });

        await redisDel(`auth:me:${userId}`);

        res.json(buildMePayload(updated));
    } catch (error: any) {
        console.error('[auth/updateMe]', error?.message || error);
        const raw = error?.message || '';
        let msg = 'No se pudo guardar. Intente de nuevo.';
        if (raw.includes('contraseña') || raw.includes('password')) msg = 'Revise la contraseña actual e intente de nuevo.';
        else if (raw.includes('Unique') || raw.includes('unique')) msg = 'Ese correo o nombre ya está en uso.';
        else if (raw.includes('Prisma') || raw.includes('invocation')) msg = 'Error al guardar los datos. Intente más tarde.';
        res.status(500).json({ error: msg });
    }
};


/**
 * POST /auth/complete-2fa-login
 * Completa el login después de verificar el código 2FA
 */
export const complete2FALogin = async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email requerido' });
    }

    try {
        const user = await prisma.usuario.findUnique({
            where: { email },
            select: {
                id: true,
                nombre: true,
                email: true,
                activo: true,
                roleId: true,
                cargoId: true,
                fotoPerfil: true,
                twoFactorEnabled: true,
                roleRelacion: { select: { codigo: true, ambito: true, permisos: true } },
                cargo: { select: { nombre: true } }
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        if (!user.activo) {
            return res.status(401).json({ success: false, error: 'Usuario inactivo' });
        }

        const roleCodigo = user.roleRelacion?.codigo || 'usuario';
        const roleAmbito = (user.roleRelacion as { ambito?: string })?.ambito || 'OPERATIVO';
        const permisos = (user.roleRelacion as { permisos?: { visualizar?: boolean; editar?: boolean } })?.permisos || {};
        const puedeVisualizar = permisos.visualizar !== false;
        const puedeEditar = permisos.editar === true;

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: roleCodigo
        });

        if (IS_DEV) {
            console.log('[auth/complete-2fa-login] login completado con 2FA', {
                userId: user.id,
                email: user.email,
            });
        }

        res.json({
            success: true,
            token,
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            user: {
                id: user.id,
                username: user.email.split('@')[0],
                email: user.email,
                fullName: user.nombre,
                role: roleCodigo,
                department: user.cargo?.nombre || 'General',
                position: user.cargo?.nombre || roleCodigo,
                esDuenoProcesos: roleCodigo === 'dueño_procesos',
                fotoPerfil: (user as { fotoPerfil?: string | null }).fotoPerfil ?? null,
                ambito: roleAmbito,
                puedeVisualizar,
                puedeEditar,
                twoFactorEnabled: user.twoFactorEnabled
            }
        });
    } catch (error: any) {
        console.error('[auth/complete-2fa-login]', error?.message || error);
        res.status(500).json({ success: false, error: 'No se pudo completar el login. Intente de nuevo.' });
    }
};
