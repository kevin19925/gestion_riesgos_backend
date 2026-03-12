import { Request, Response } from 'express';
import prisma from '../prisma';

/** Códigos de roles del sistema que no se pueden eliminar ni cambiar de código */
const ROLES_PROTEGIDOS = ['admin', 'dueño_procesos', 'gerente', 'supervisor'];

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { id: 'asc' }
        });
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching roles' });
    }
};

export const getRoleById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const role = await prisma.role.findUnique({
            where: { id },
            select: {
                id: true,
                codigo: true,
                nombre: true,
                descripcion: true,
                ambito: true,
                permisos: true,
                activo: true,
                usuarios: { select: { id: true, nombre: true, email: true } },
            },
        });
        if (!role) return res.status(404).json({ error: 'Role not found' });
        res.json(role);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching role' });
    }
};

export const createRole = async (req: Request, res: Response) => {
    const { codigo, nombre, descripcion, ambito, permisos, activo } = req.body;
    try {
        if (!codigo || !nombre) {
            return res.status(400).json({ error: 'codigo and nombre are required' });
        }
        const ambitoValido = ambito === 'SISTEMA' || ambito === 'OPERATIVO' ? ambito : 'OPERATIVO';

        const nuevoRole = await prisma.role.create({
            data: {
                codigo: String(codigo).toLowerCase(),
                nombre,
                descripcion: descripcion || null,
                ambito: ambitoValido,
                permisos: permisos || null,
                activo: activo !== undefined ? Boolean(activo) : true
            }
        });
        res.json(nuevoRole);
    } catch (error: any) {
        res.status(500).json({
            error: 'Error creating role',
            details: error.message
        });
    }
};

export const updateRole = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { nombre, descripcion, ambito, permisos, activo } = req.body;
    try {
        // El código no se puede editar (solo se define al crear el rol)
        const updateData: any = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (ambito !== undefined) updateData.ambito = ambito === 'SISTEMA' || ambito === 'OPERATIVO' ? ambito : 'OPERATIVO';
        if (permisos !== undefined) updateData.permisos = permisos;
        if (activo !== undefined) updateData.activo = Boolean(activo);

        const role = await prisma.role.update({
            where: { id },
            data: updateData
        });
        res.json(role);
    } catch (error: any) {
        res.status(500).json({
            error: 'Error updating role',
            details: error.message
        });
    }
};

export const deleteRole = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
        const role = await prisma.role.findUnique({ where: { id } });
        if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

        if (ROLES_PROTEGIDOS.includes(role.codigo)) {
            return res.status(400).json({
                error: 'No se puede eliminar un rol del sistema (admin, dueño_procesos, gerente, supervisor).'
            });
        }

        const usuariosConRol = await prisma.usuario.count({
            where: { roleId: id }
        });

        if (usuariosConRol > 0) {
            return res.status(400).json({
                error: `No se puede eliminar el rol porque ${usuariosConRol} usuario(s) lo están usando`
            });
        }

        await prisma.role.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({
            error: 'Error deleting role',
            details: error.message
        });
    }
};

