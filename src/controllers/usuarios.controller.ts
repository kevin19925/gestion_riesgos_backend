import { Request, Response } from 'express';
import prisma from '../prisma';
import { getDeleteErrorMessage } from '../utils/prismaErrors';
import { hashPassword } from '../utils/password';

export const getUsuarios = async (req: Request, res: Response) => {
    try {
        const users = await prisma.usuario.findMany({
            select: {
                id: true,
                nombre: true,
                email: true,
                password: true,
                activo: true,
                roleId: true,
                cargoId: true,
                createdAt: true,
                updatedAt: true,
                cargo: { select: { id: true, nombre: true } },
                roleRelacion: { select: { id: true, codigo: true, nombre: true } },
            },
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
            select: {
                id: true,
                nombre: true,
                email: true,
                password: true,
                activo: true,
                roleId: true,
                cargoId: true,
                createdAt: true,
                updatedAt: true,
                cargo: { select: { id: true, nombre: true } },
                roleRelacion: { select: { id: true, codigo: true, nombre: true } },
            },
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
        
        console.log('[createUsuario] Datos recibidos:', { nombre, email, roleId, cargoId, activo });
        
        if (!roleId) {
            console.log('[createUsuario] Error: roleId faltante');
            return res.status(400).json({ error: 'roleId is required' });
        }
        
        if (!nombre || !email) {
            console.log('[createUsuario] Error: nombre o email faltante');
            return res.status(400).json({ error: 'nombre and email are required' });
        }
        const emailStr = String(email).trim();
        console.log('[createUsuario] Email a validar:', emailStr);
        
        // Validación simple: debe tener @ y al menos un punto después del @
        if (!emailStr.includes('@') || !emailStr.split('@')[1]?.includes('.')) {
            console.log('[createUsuario] Error: formato de email inválido');
            return res.status(400).json({ error: 'El correo no tiene un formato válido' });
        }
        
        // Verificar que el rol existe
        const roleData = await prisma.role.findUnique({
            where: { id: Number(roleId) }
        });
        
        if (!roleData) {
            console.log('[createUsuario] Error: rol no existe');
            return res.status(400).json({ error: `Role with ID ${roleId} does not exist` });
        }
        
        // Verificar que el cargo existe si se proporciona
        if (cargoId) {
            const cargoExists = await prisma.cargo.findUnique({
                where: { id: Number(cargoId) }
            });
            
            if (!cargoExists) {
                console.log('[createUsuario] Error: cargo no existe');
                return res.status(400).json({ error: `Cargo with ID ${cargoId} does not exist` });
            }
        }

        const plainPassword = String(password || 'comware123');
        const hashedPassword = await hashPassword(plainPassword);

        console.log('[createUsuario] Insertando usuario en BD');
        await prisma.$executeRaw`
            INSERT INTO "Usuario" (nombre, email, password, "roleId", "cargoId", activo, "createdAt", "updatedAt")
            VALUES (${nombre}, ${emailStr}, ${hashedPassword}, ${Number(roleId)}, ${cargoId ? Number(cargoId) : null}, ${activo ?? true}, NOW(), NOW())
        `;

        console.log('[createUsuario] Usuario insertado, buscando datos...');
        const user = await prisma.usuario.findFirst({
            where: { email: emailStr },
            select: {
                id: true,
                nombre: true,
                email: true,
                password: true,
                activo: true,
                roleId: true,
                cargoId: true,
                createdAt: true,
                updatedAt: true,
                cargo: { select: { id: true, nombre: true } },
                roleRelacion: { select: { id: true, codigo: true, nombre: true } },
            },
        });
        
        console.log('[createUsuario] Usuario creado exitosamente');
        res.status(201).json(user);
    } catch (error: any) {
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
        if (email !== undefined) {
            const emailStr = String(email).trim();
            // Validación simple: debe tener @ y al menos un punto después del @
            if (!emailStr.includes('@') || !emailStr.split('@')[1]?.includes('.')) {
                return res.status(400).json({ error: 'El correo no tiene un formato válido' });
            }
            updateData.email = emailStr;
        }
        if (password !== undefined) updateData.password = await hashPassword(String(password));
        if (roleId !== undefined) updateData.roleId = Number(roleId);
        if (cargoId !== undefined) updateData.cargoId = cargoId ? Number(cargoId) : null;
        if (activo !== undefined) updateData.activo = activo;

        const user = await prisma.usuario.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                nombre: true,
                email: true,
                password: true,
                activo: true,
                roleId: true,
                cargoId: true,
                createdAt: true,
                updatedAt: true,
                cargo: { select: { id: true, nombre: true } },
                roleRelacion: { select: { id: true, codigo: true, nombre: true } },
            },
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error updating user' });
    }
};

export const deleteUsuario = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        await prisma.usuario.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        const msg = getDeleteErrorMessage(error, 'usuario', 'procesos, asignaciones o registros asociados');
        const status = (error as any)?.code === 'P2025' ? 404 : (error as any)?.code === 'P2003' ? 400 : 500;
        res.status(status).json({ error: msg });
    }
};
