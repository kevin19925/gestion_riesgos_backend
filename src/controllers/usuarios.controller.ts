import { Request, Response } from 'express';
import prisma from '../prisma';

export const getUsuarios = async (req: Request, res: Response) => {
    try {
        const users = await prisma.usuario.findMany({
            include: { cargo: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
};

export const getUsuarioById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const user = await prisma.usuario.findUnique({
            where: { id },
            include: { cargo: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user' });
    }
};
