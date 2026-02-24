import { Request, Response } from 'express';
import prisma from '../prisma';

export const getUsuarios = async (req: Request, res: Response) => {
    try {
        const users = await prisma.usuario.findMany({
            include: { 
                cargo: true,
                role: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
};

export const getUsuarioById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const user = await prisma.usuario.findUnique({
            where: { id },
            include: { 
                cargo: true,
                role: true
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user' });
    }
};

export const createUsuario = async (req: Request, res: Response) => {
    try {
        const { nombre, email, password, roleId, cargoId, activo } = req.body;
        
        if (!roleId) {
            return res.status(400).json({ error: 'roleId is required' });
        }

        const user = await prisma.usuario.create({
            data: {
                nombre,
                email,
                password: password || 'comware123',
                roleId: Number(roleId),
                cargoId: cargoId ? Number(cargoId) : null,
                activo: activo ?? true
            },
            include: { 
                cargo: true,
                role: true
            }
        });
        res.status(201).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
};

export const updateUsuario = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const { nombre, email, password, roleId, cargoId, activo } = req.body;
        const updateData: any = {};
        
        if (nombre !== undefined) updateData.nombre = nombre;
        if (email !== undefined) updateData.email = email;
        if (password !== undefined) updateData.password = password;
        if (roleId !== undefined) updateData.roleId = Number(roleId);
        if (cargoId !== undefined) updateData.cargoId = cargoId ? Number(cargoId) : null;
        if (activo !== undefined) updateData.activo = activo;

        const user = await prisma.usuario.update({
            where: { id },
            data: updateData,
            include: { 
                cargo: true,
                role: true
            }
        });
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error updating user' });
    }
};

export const deleteUsuario = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.usuario.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
};
