import { Request, Response } from 'express';
import prisma from '../prisma';
import { signToken } from '../utils/jwt';
import { deleteBlobByUrl, isAzureBlobConfigured } from '../utils/azureBlob';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    try {
        const normalizedUsername = String(username).trim();
        const normalizedPassword = String(password).trim();

        console.log('[auth/login] intento de login', {
            username: normalizedUsername,
            // Nunca loguear la contraseña
        });

        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { email: normalizedUsername },
                    { email: `${normalizedUsername}@comware.com.co` }
                ],
                password: normalizedPassword
            },
            select: {
                id: true,
                nombre: true,
                email: true,
                activo: true,
                roleId: true,
                cargoId: true,
                fotoPerfil: true,
                role: { select: { codigo: true, ambito: true, permisos: true } },
                cargo: { select: { nombre: true } }
            }
        });

        if (!user) {
            console.warn('[auth/login] usuario no encontrado o contraseña incorrecta', {
                username: normalizedUsername,
            });
            return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
        }

        if (!user.activo) {
            console.warn('[auth/login] usuario inactivo', {
                userId: user.id,
                email: user.email,
            });
            return res.status(401).json({ success: false, error: 'Usuario inactivo' });
        }

        const roleCodigo = user.role?.codigo || 'usuario';
        const roleAmbito = (user.role as { ambito?: string })?.ambito || 'OPERATIVO';
        const permisos = (user.role as { permisos?: { visualizar?: boolean; editar?: boolean } })?.permisos || {};
        const puedeVisualizar = permisos.visualizar !== false;
        const puedeEditar = permisos.editar === true;

        console.log('[auth/login] login exitoso', {
            userId: user.id,
            email: user.email,
            roleCodigo,
            roleAmbito,
            puedeVisualizar,
            puedeEditar,
        });

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: roleCodigo
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
                puedeEditar
            }
        });
    } catch (error: any) {
        console.error('[auth/login]', error?.message || error);
        res.status(500).json({ success: false, error: 'No se pudo iniciar sesión. Intente de nuevo.' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    const id = (req as any).user?.userId ?? req.query.id;
    if (!id) return res.status(400).json({ error: 'User ID or token required' });

    try {
        const user = await prisma.usuario.findUnique({
            where: { id: Number(id) },
            select: {
                id: true,
                nombre: true,
                email: true,
                activo: true,
                roleId: true,
                cargoId: true,
                fotoPerfil: true,
                role: { select: { codigo: true, ambito: true, permisos: true } },
                cargo: { select: { nombre: true } }
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.activo) return res.status(403).json({ error: 'User inactive' });

        const roleCodigo = user.role?.codigo || 'usuario';
        const roleAmbito = (user.role as { ambito?: string })?.ambito || 'OPERATIVO';
        const permisos = (user.role as { permisos?: { visualizar?: boolean; editar?: boolean } })?.permisos || {};
        const puedeVisualizar = permisos.visualizar !== false;
        const puedeEditar = permisos.editar === true;

        res.json({
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
            puedeEditar
        });
    } catch (error: any) {
        console.error('[auth/getMe]', error?.message || error);
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
            include: { cargo: true, role: true }
        });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!user.activo) return res.status(403).json({ error: 'Usuario inactivo' });

        const updateData: { nombre?: string; password?: string; fotoPerfil?: string | null } = {};

        if (nombre !== undefined && typeof nombre === 'string' && nombre.trim()) {
            updateData.nombre = nombre.trim();
        }

        if (passwordNueva !== undefined && passwordNueva !== '') {
            if (!passwordActual || user.password !== passwordActual) {
                return res.status(400).json({ error: 'La contraseña actual no es correcta' });
            }
            updateData.password = passwordNueva;
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
            include: { cargo: true, role: true }
        });

        const roleCodigo = updated.role?.codigo || 'usuario';
        const roleAmbito = (updated.role as { ambito?: string })?.ambito || 'OPERATIVO';
        const permisos = (updated.role as { permisos?: { visualizar?: boolean; editar?: boolean } })?.permisos || {};
        const puedeVisualizar = permisos.visualizar !== false;
        const puedeEditar = permisos.editar === true;

        res.json({
            id: updated.id,
            username: updated.email.split('@')[0],
            email: updated.email,
            fullName: updated.nombre,
            role: roleCodigo,
            department: updated.cargo?.nombre || 'General',
            position: updated.cargo?.nombre || roleCodigo,
            esDuenoProcesos: roleCodigo === 'dueño_procesos',
            fotoPerfil: (updated as any).fotoPerfil ?? null,
            ambito: roleAmbito,
            puedeVisualizar,
            puedeEditar
        });
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
