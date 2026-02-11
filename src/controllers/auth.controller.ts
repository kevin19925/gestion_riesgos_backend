import { Request, Response } from 'express';
import prisma from '../prisma';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    console.log(`[BACKEND] login request - username: ${username}`);

    try {
        const user = await prisma.usuario.findFirst({
            where: {
                OR: [
                    { email: username },
                    { email: `${username}@comware.com.ec` }
                ],
                password: password
            },
            include: { cargo: true }
        });

        if (!user) {
            console.warn(`[BACKEND] Login failed for: ${username}`);
            return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
        }

        if (!user.activo) {
            console.warn(`[BACKEND] Inactive user login attempt: ${username}`);
            return res.status(401).json({ success: false, error: 'Usuario inactivo' });
        }

        console.log(`[BACKEND] Login successful: ${user.email}`);
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.email.split('@')[0],
                email: user.email,
                fullName: user.nombre,
                role: user.role,
                department: user.cargo?.nombre || 'General',
                position: user.cargo?.nombre || user.role,
                esDuenoProcesos: user.role === 'dueño_procesos'
            }
        });
    } catch (error) {
        console.error('[BACKEND] Login system error:', error);
        res.status(500).json({ success: false, error: 'Error en el servidor' });
    }
};

export const getMe = async (req: Request, res: Response) => {
    const { id } = req.query;
    console.log(`[BACKEND] getMe - id: ${id}`);
    if (!id) return res.status(400).json({ error: 'User ID required' });

    try {
        const user = await prisma.usuario.findUnique({
            where: { id: Number(id) },
            include: { cargo: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            id: user.id,
            username: user.email.split('@')[0],
            email: user.email,
            fullName: user.nombre,
            role: user.role,
            department: user.cargo?.nombre || 'General',
            position: user.cargo?.nombre || user.role,
            esDuenoProcesos: user.role === 'dueño_procesos'
        });
    } catch (error) {
        console.error('[BACKEND] getMe error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
