import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * INCIDENCIAS/EVENTOS CONTROLLER
 * Gestiona incidencias (materialización de riesgos)
 */

export const getIncidencias = async (req: Request, res: Response) => {
  try {
    const { procesoId, riesgoId } = req.query;
    const where: any = {};
    if (procesoId) where.procesoId = Number(procesoId);
    if (riesgoId) where.riesgoId = Number(riesgoId);

    const incidencias = await prisma.incidencia.findMany({
      where,
      orderBy: { fechaOcurrencia: 'desc' },
      include: {
        riesgo: true,
        proceso: true,
        responsable: true
      }
    });

    res.json(incidencias);
  } catch (error) {
    console.error('[BACKEND] Error in getIncidencias:', error);
    res.status(500).json({ error: 'Error fetching incidencias' });
  }
};

export const getIncidenciasByRiesgo = async (req: Request, res: Response) => {
  try {
    const riesgoId = Number(req.params.riesgoId);

    const incidencias = await prisma.incidencia.findMany({
      where: { riesgoId },
      orderBy: { fechaOcurrencia: 'desc' },
      include: {
        riesgo: true,
        proceso: true,
        responsable: true
      }
    });

    res.json(incidencias);
  } catch (error) {
    console.error('[BACKEND] Error in getIncidenciasByRiesgo:', error);
    res.status(500).json({ error: 'Error fetching incidencias' });
  }
};

export const getIncidenciaById = async (req: Request, res: Response) => {
  try {
    const incidenciaId = Number(req.params.id);
    
    const incidencia = await prisma.incidencia.findUnique({
      where: { id: incidenciaId },
      include: {
        riesgo: true,
        proceso: true,
        responsable: true
      }
    });
    
    if (!incidencia) {
      return res.status(404).json({ error: 'Incidencia not found' });
    }
    
    res.json(incidencia);
  } catch (error) {
    console.error('[BACKEND] Error in getIncidenciaById:', error);
    res.status(500).json({ error: 'Error fetching incidencia' });
  }
};

export const createIncidencia = async (req: Request, res: Response) => {
  try {
    const {
      riesgoId,
      procesoId,
      codigo,
      titulo,
      fechaOcurrencia,
      fechaReporte,
      fechaResolucion,
      descripcion,
      estado = 'Reportada',
      reportadoPor,
      responsableId,
      accionesCorrectivas,
      impactosMaterializacion
    } = req.body;

    const riesgoIdParam = req.params.riesgoId;
    const finalRiesgoId = riesgoId || riesgoIdParam;
    
    if (!descripcion) {
      return res.status(400).json({ error: 'descripcion is required' });
    }

    const incidencia = await prisma.incidencia.create({
      data: {
        ...(finalRiesgoId && { riesgoId: Number(finalRiesgoId) }),
        ...(procesoId && { procesoId: Number(procesoId) }),
        codigo: codigo || `INC-${Date.now()}`,
        titulo,
        descripcion,
        estado,
        fechaOcurrencia: fechaOcurrencia ? new Date(fechaOcurrencia) : new Date(),
        ...(fechaReporte && { fechaReporte: new Date(fechaReporte) }),
        ...(fechaResolucion && { fechaResolucion: new Date(fechaResolucion) }),
        reportadoPor,
        ...(responsableId && { responsableId: Number(responsableId) }),
        accionesCorrectivas,
        impactosMaterializacion: impactosMaterializacion || undefined
      }
    });
    
    res.status(201).json(incidencia);
  } catch (error) {
    console.error('[BACKEND] Error in createIncidencia:', error);
    res.status(500).json({ error: 'Error creating incidencia' });
  }
};

export const updateIncidencia = async (req: Request, res: Response) => {
  try {
    const incidenciaId = Number(req.params.id);
    const {
      codigo,
      titulo,
      descripcion,
      estado,
      fechaOcurrencia,
      fechaReporte,
      fechaResolucion,
      reportadoPor,
      responsableId,
      accionesCorrectivas,
      impactosMaterializacion
    } = req.body;
    
    // Calcular impacto promedio si hay cambios
    let updateData: any = {};

    if (codigo) updateData.codigo = codigo;
    if (titulo) updateData.titulo = titulo;
    if (descripcion) updateData.descripcion = descripcion;
    if (estado) updateData.estado = estado;
    if (fechaOcurrencia) updateData.fechaOcurrencia = new Date(fechaOcurrencia);
    if (fechaReporte) updateData.fechaReporte = new Date(fechaReporte);
    if (fechaResolucion) updateData.fechaResolucion = new Date(fechaResolucion);
    if (reportadoPor) updateData.reportadoPor = reportadoPor;
    if (responsableId) updateData.responsableId = Number(responsableId);
    if (accionesCorrectivas) updateData.accionesCorrectivas = accionesCorrectivas;
    if (impactosMaterializacion) updateData.impactosMaterializacion = impactosMaterializacion;
    
    const incidencia = await prisma.incidencia.update({
      where: { id: incidenciaId },
      data: updateData
    });
    
    res.json(incidencia);
  } catch (error) {
    console.error('[BACKEND] Error in updateIncidencia:', error);
    res.status(500).json({ error: 'Error updating incidencia' });
  }
};

export const deleteIncidencia = async (req: Request, res: Response) => {
  try {
    const incidenciaId = Number(req.params.id);
    
    await prisma.incidencia.delete({
      where: { id: incidenciaId }
    });
    
    res.json({ message: 'Incidencia deleted successfully' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ error: 'Incidencia not found' });
    }
    console.error('[BACKEND] Error in deleteIncidencia:', error);
    res.status(500).json({ error: 'Error deleting incidencia' });
  }
};

export const getIncidenciasByPeriodo = async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query;
    
    if (!desde || !hasta) {
      return res.status(400).json({
        error: 'Se requieren parámetros desde y hasta (YYYY-MM-DD)'
      });
    }
    
    const incidencias = await prisma.incidencia.findMany({
      where: {
        fechaOcurrencia: {
          gte: new Date(String(desde)),
          lte: new Date(String(hasta))
        }
      },
      orderBy: { fechaOcurrencia: 'desc' }
    });
    
    res.json(incidencias);
  } catch (error) {
    console.error('[BACKEND] Error in getIncidenciasByPeriodo:', error);
    res.status(500).json({ error: 'Error fetching incidencias by periodo' });
  }
};

export const getIncidenciasEstadisticas = async (req: Request, res: Response) => {
  try {
    const { riesgoId, procesoId } = req.query;

    const where: any = {};
    if (riesgoId) where.riesgoId = Number(riesgoId);
    if (procesoId) where.procesoId = Number(procesoId);

    const incidencias = await prisma.incidencia.findMany({ where });

    const impactoPromedios = incidencias.map((i) => {
      const impactos = (i.impactosMaterializacion || {}) as Record<string, number>;
      const valores = Object.values(impactos).filter((v) => typeof v === 'number');
      if (valores.length === 0) return 0;
      const total = valores.reduce((sum, v) => sum + v, 0);
      return total / valores.length;
    });

    const estadisticas = {
      total: incidencias.length,
      porEstado: incidencias.reduce<Record<string, number>>((acc, i) => {
        acc[i.estado] = (acc[i.estado] || 0) + 1;
        return acc;
      }, {}),
      impactoPromedio: impactoPromedios.length > 0
        ? impactoPromedios.reduce((sum, v) => sum + v, 0) / impactoPromedios.length
        : 0,
      impactoMaximo: impactoPromedios.length > 0
        ? Math.max(...impactoPromedios)
        : 0
    };
    
    res.json(estadisticas);
  } catch (error) {
    console.error('[BACKEND] Error in getIncidenciasEstadisticas:', error);
    res.status(500).json({ error: 'Error fetching incidencias estadisticas' });
  }
};
