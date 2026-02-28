import { Request, Response } from 'express';
import prisma from '../prisma';
import { signToken } from '../utils/jwt';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    try {
        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { email: username },
                    { email: `${username}@comware.com.co` }
                ],
                password: password
            },
            include: { cargo: true, role: true }
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
        }

        if (!user.activo) {
            return res.status(401).json({ success: false, error: 'Usuario inactivo' });
        }

        const roleCodigo = user.role?.codigo || 'usuario';
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
                esDuenoProcesos: roleCodigo === 'dueño_procesos'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error en el servidor' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    const id = (req as any).user?.userId ?? req.query.id;
    if (!id) return res.status(400).json({ error: 'User ID or token required' });

    try {
        const user = await prisma.usuario.findUnique({
            where: { id: Number(id) },
            include: { cargo: true, role: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.activo) return res.status(403).json({ error: 'User inactive' });

        const roleCodigo = user.role?.codigo || 'usuario';
        res.json({
            id: user.id,
            username: user.email.split('@')[0],
            email: user.email,
            fullName: user.nombre,
            role: roleCodigo,
            department: user.cargo?.nombre || 'General',
            position: user.cargo?.nombre || roleCodigo,
            esDuenoProcesos: roleCodigo === 'dueño_procesos'
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
