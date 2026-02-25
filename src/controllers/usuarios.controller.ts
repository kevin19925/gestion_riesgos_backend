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
        
        if (!nombre || !email) {
            return res.status(400).json({ error: 'nombre and email are required' });
        }
        
        // Obtener el código del rol para el campo role (string)
        const roleData = await prisma.role.findUnique({
            where: { id: Number(roleId) }
        });
        
        if (!roleData) {
            return res.status(400).json({ error: `Role with ID ${roleId} does not exist` });
        }
        
        const roleCodigo = roleData.codigo;
        
        // Verificar que el cargo existe si se proporciona
        if (cargoId) {
            const cargoExists = await prisma.cargo.findUnique({
                where: { id: Number(cargoId) }
            });
            
            if (!cargoExists) {
                return res.status(400).json({ error: `Cargo with ID ${cargoId} does not exist` });
            }
        }

        const result = await prisma.$executeRaw`
            INSERT INTO "Usuario" (nombre, email, password, role, "roleId", "cargoId", activo, "createdAt", "updatedAt")
            VALUES (${nombre}, ${email}, ${password || 'comware123'}, ${roleCodigo}, ${Number(roleId)}, ${cargoId ? Number(cargoId) : null}, ${activo ?? true}, NOW(), NOW())
        `;
        
        // Obtener el usuario recién creado
        const user = await prisma.usuario.findFirst({
            where: { email },
            include: { 
                cargo: true,
                role: true
            }
        });
        
        res.status(201).json(user);
    } catch (error: any) {
        console.error('[BACKEND] Error creating user:', error);
        res.status(500).json({ 
            error: 'Error creating user',
            details: error.message || String(error)
        });
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
