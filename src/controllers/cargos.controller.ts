import { Request, Response } from 'express';
import prisma from '../prisma';

export const getCargos = async (req: Request, res: Response) => {
    try {
        const cargos = await prisma.cargo.findMany();
        res.json(cargos);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching cargos' });
    }
};

export const getCargoById = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const cargo = await prisma.cargo.findUnique({
            where: { id }
        });
        if (!cargo) return res.status(404).json({ error: 'Cargo not found' });
        res.json(cargo);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching cargo' });
    }
};

export const createCargo = async (req: Request, res: Response) => {
    try {
        const cargo = await prisma.cargo.create({
            data: req.body
        });
        res.status(201).json(cargo);
    } catch (error) {
        console.error('Error creating cargo:', error);
        res.status(500).json({ error: 'Error creating cargo' });
    }
};

export const updateCargo = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const cargo = await prisma.cargo.update({
            where: { id },
            data: req.body
        });
        res.json(cargo);
    } catch (error) {
        res.status(500).json({ error: 'Error updating cargo' });
    }
};

export const deleteCargo = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.cargo.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting cargo' });
    }
};
