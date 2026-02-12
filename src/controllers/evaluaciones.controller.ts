import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * EVALUACIONES CONTROLLER
 * ⭐ CRÍTICO: Calcula automáticamente riesgo inherente y clasificación
 */

// Helper: Calcular promedio de impactos multidimensionales
function calcularImpactoPromedio(dimensiones: number[]): number {
  if (!dimensiones || dimensiones.length === 0) return 0;
  const suma = dimensiones.reduce((a, b) => a + b, 0);
  return suma / dimensiones.length;
}

// Helper: Calcular riesgo inherente
function calcularRiesgoInherente(impactoPromedio: number, probabilidad: number): number {
  return impactoPromedio * probabilidad;
}

// Helper: Clasificar riesgo por valor
function clasificarRiesgo(valor: number): string {
  if (valor <= 25) return 'BAJO';
  if (valor <= 50) return 'MEDIO';
  if (valor <= 75) return 'ALTO';
  return 'CRÍTICO';
}

export const getEvaluacionesByRiesgo = async (req: Request, res: Response) => {
    const riesgoId = Number(req.params.riesgoId);
    console.log(`[BACKEND] getEvaluacionesByRiesgo - riesgoId: ${riesgoId}`);
    try {
        const evaluacion = await prisma.evaluacionRiesgo.findUnique({
            where: { riesgoId }
        });
        // Return as array for compatibility
        res.json(evaluacion ? [evaluacion] : []);
    } catch (error) {
        console.error('[BACKEND] Error in getEvaluacionesByRiesgo:', error);
        res.status(500).json({ error: 'Error fetching evaluaciones' });
    }
};

export const getEvaluacionById = async (req: Request, res: Response) => {
    const evaluacionId = Number(req.params.id);
    try {
        const evaluacion = await prisma.evaluacionRiesgo.findUnique({
            where: { id: evaluacionId }
        });
        if (!evaluacion) {
            return res.status(404).json({ error: 'Evaluacion not found' });
        }
        res.json(evaluacion);
    } catch (error) {
        console.error('[BACKEND] Error in getEvaluacionById:', error);
        res.status(500).json({ error: 'Error fetching evaluacion' });
    }
};

export const createEvaluacion = async (req: Request, res: Response) => {
    console.log('[BACKEND] createEvaluacion - body:', JSON.stringify(req.body, null, 2));
    const {
        riesgoId,
        dimensiones = [],
        probabilidad = 0,
        ...otrosDatos
    } = req.body;
    
    const rId = Number(riesgoId);
    
    try {
        // 1. Calcular impacto promedio
        const impactoPromedio = calcularImpactoPromedio(dimensiones);
        
        // 2. Calcular riesgo inherente
        const riesgoInherente = calcularRiesgoInherente(impactoPromedio, probabilidad);
        
        // 3. Clasificar riesgo inherente
        const clasificacionInherente = clasificarRiesgo(riesgoInherente);
        
        console.log('[BACKEND] Calculated values:', {
            impactoPromedio,
            riesgoInherente,
            clasificacionInherente
        });
        
        // 4. Intentar crear
        const evaluacion = await prisma.evaluacionRiesgo.create({
            data: {
                riesgoId: rId,
                dimensiones,
                probabilidad,
                impactoPromedio,
                riesgoInherente,
                clasificacionInherente,
                ...otrosDatos
            }
        });
        
        console.log('[BACKEND] Evaluacion created with automatic calculations:', evaluacion);
        res.status(201).json(evaluacion);
        
    } catch (error) {
        console.warn(`[BACKEND] Error creating evaluacion, attempting update: ${rId}`);
        // Si existe, actualizar
        try {
            const existing = await prisma.evaluacionRiesgo.findUnique({ 
                where: { riesgoId: rId } 
            });
            
            if (existing) {
                // Recalcular valores
                const impactoPromedio = calcularImpactoPromedio(dimensiones);
                const riesgoInherente = calcularRiesgoInherente(impactoPromedio, probabilidad);
                const clasificacionInherente = clasificarRiesgo(riesgoInherente);
                
                const updated = await prisma.evaluacionRiesgo.update({
                    where: { riesgoId: rId },
                    data: {
                        dimensiones,
                        probabilidad,
                        impactoPromedio,
                        riesgoInherente,
                        clasificacionInherente,
                        ...otrosDatos
                    }
                });
                console.log('[BACKEND] Evaluacion updated with recalculation:', updated);
                return res.json(updated);
            }
        } catch (innerError) {
            console.error('[BACKEND] Error updating existing evaluacion:', innerError);
        }

        console.error('[BACKEND] Final error in createEvaluacion:', error);
        res.status(500).json({ error: 'Error creating evaluacion' });
    }
};

export const updateEvaluacion = async (req: Request, res: Response) => {
    console.log('[BACKEND] updateEvaluacion - body:', JSON.stringify(req.body, null, 2));
    const evaluacionId = Number(req.params.id);
    const {
        dimensiones,
        probabilidad,
        ...otrosDatos
    } = req.body;
    
    try {
        const evaluacionActual = await prisma.evaluacionRiesgo.findUnique({
            where: { id: evaluacionId }
        });
        
        if (!evaluacionActual) {
            return res.status(404).json({ error: 'Evaluacion not found' });
        }
        
        // Usar valores nuevos o los actuales
        const newDimensiones = dimensiones !== undefined ? dimensiones : evaluacionActual.impactoGlobal;
        const newProbabilidad = probabilidad !== undefined ? probabilidad : evaluacionActual.probabilidad;
        
        // Recalcular
        const impactoPromedio = calcularImpactoPromedio(newDimensiones);
        const riesgoInherente = calcularRiesgoInherente(impactoPromedio, newProbabilidad);
        const clasificacionInherente = clasificarRiesgo(riesgoInherente);
        
        console.log('[BACKEND] Recalculated values:', {
            impactoPromedio,
            riesgoInherente,
            clasificacionInherente
        });
        
        const evaluacion = await prisma.evaluacionRiesgo.update({
            where: { id: evaluacionId },
            data: {
                dimensiones: newDimensiones,
                probabilidad: newProbabilidad,
                impactoPromedio,
                riesgoInherente,
                clasificacionInherente,
                ...otrosDatos
            }
        });
        
        console.log('[BACKEND] Evaluacion updated with recalculation:', evaluacion);
        res.json(evaluacion);
        
    } catch (error) {
        console.error('[BACKEND] Error in updateEvaluacion:', error);
        res.status(500).json({ error: 'Error updating evaluacion' });
    }
};

export const deleteEvaluacion = async (req: Request, res: Response) => {
    try {
        const evaluacionId = Number(req.params.id);
        
        await prisma.evaluacionRiesgo.delete({
            where: { id: evaluacionId }
        });
        
        res.json({ message: 'Evaluacion deleted successfully' });
    } catch (error) {
        if ((error as any).code === 'P2025') {
            return res.status(404).json({ error: 'Evaluacion not found' });
        }
        console.error('[BACKEND] Error in deleteEvaluacion:', error);
        res.status(500).json({ error: 'Error deleting evaluacion' });
    }
};

