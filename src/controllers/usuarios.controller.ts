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

export const createUsuario = async (req: Request, res: Response) => {
    try {
        const { nombre, email, password, role, cargoId, activo } = req.body;
        const user = await prisma.usuario.create({
            data: {
                nombre,
                email,
                password: password || 'comware123',
                role,
                cargoId,
                activo: activo ?? true
            },
            include: { cargo: true }
        });
        res.status(201).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
};

export const updateUsuario = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { nombre, email, password, role, cargoId, activo } = req.body;
        const user = await prisma.usuario.update({
            where: { id },
            data: {
                nombre,
                email,
                password,
                role,
                cargoId,
                activo
            },
            include: { cargo: true }
        });
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error updating user' });
    }
};

export const deleteUsuario = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.usuario.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
};
