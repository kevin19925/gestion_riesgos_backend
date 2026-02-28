/**
 * Rutas de diagnóstico temporal
 * ELIMINAR EN PRODUCCIÓN
 */

import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/debug/test-responsables/:procesoId
router.get('/test-responsables/:procesoId', async (req: Request, res: Response) => {
    try {
        const procesoId = Number(req.params.procesoId);
        
        // 1. Verificar que el proceso existe
        const proceso = await prisma.proceso.findUnique({
            where: { id: procesoId },
            select: { id: true, nombre: true }
        });
        
        if (!proceso) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }
        
        // 2. Ver responsables actuales
        const responsablesActuales = await prisma.procesoResponsable.findMany({
            where: { procesoId },
            include: {
                usuario: {
                    select: { id: true, nombre: true }
                }
            }
        });
        
        // 3. Intentar crear un responsable de prueba
        let testInsert = null;
        let testError = null;
        try {
            testInsert = await prisma.procesoResponsable.create({
                data: {
                    procesoId,
                    usuarioId: 101, // Usuario de prueba
                    modo: 'proceso'
                }
            });
            
            // Eliminar el registro de prueba
            await prisma.procesoResponsable.delete({
                where: { id: testInsert.id }
            });
        } catch (error: any) {
            testError = {
                message: error.message,
                code: error.code,
                meta: error.meta
            };
        }
        
        res.json({
            proceso,
            responsablesActuales,
            testInsert: testInsert ? 'SUCCESS' : 'FAILED',
            testError,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({
            error: 'Error en diagnóstico',
            details: error.message,
            code: error.code,
            stack: error.stack
        });
    }
});

export default router;
