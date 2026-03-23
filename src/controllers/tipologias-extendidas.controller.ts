import { Request, Response } from 'express';
import prisma from '../prisma';

/**
 * TIPOLOGÍAS EXTENDIDAS CONTROLLER
 * Gestiona las tipologías de riesgo nivel 3 y 4
 */

/**
 * GET /api/catalogos/tipologias-extendidas
 * Obtiene todas las tipologías extendidas
 */
export const obtenerTipologiasExtendidas = async (req: Request, res: Response) => {
  try {
    const { nivel, activo } = req.query;
    const where: any = {};

    if (nivel) {
      where.nivel = Number(nivel);
    }

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    const tipologias = await prisma.tipologiaRiesgoExtendida.findMany({
      where,
      include: {
        subtipo: {
          include: {
            tipoRiesgo: true
          }
        }
      },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }]
    });

    res.json(tipologias);
  } catch (error) {
    console.error('Error al obtener tipologías extendidas:', error);
    res.status(500).json({ error: 'Error al obtener tipologías extendidas' });
  }
};

/**
 * GET /api/catalogos/tipologias-extendidas/:id
 * Obtiene una tipología extendida por ID
 */
export const obtenerTipologiaExtendidaPorId = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const tipologia = await prisma.tipologiaRiesgoExtendida.findUnique({
      where: { id },
      include: {
        subtipo: {
          include: {
            tipoRiesgo: true
          }
        }
      }
    });

    if (!tipologia) {
      return res.status(404).json({ error: 'Tipología no encontrada' });
    }

    res.json(tipologia);
  } catch (error) {
    console.error('Error al obtener tipología extendida:', error);
    res.status(500).json({ error: 'Error al obtener tipología extendida' });
  }
};

/**
 * POST /api/catalogos/tipologias-extendidas
 * Crea una nueva tipología extendida
 */
export const crearTipologiaExtendida = async (req: Request, res: Response) => {
  try {
    const { subtipoId, nivel, nombre, descripcion } = req.body;

    // Validar nivel
    if (!nivel || ![3, 4].includes(Number(nivel))) {
      return res.status(400).json({ error: 'El nivel debe ser 3 o 4' });
    }

    // Validar nombre
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    // Crear tipología
    const tipologia = await prisma.tipologiaRiesgoExtendida.create({
      data: {
        subtipoId: subtipoId ? Number(subtipoId) : null,
        nivel: Number(nivel),
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null
      },
      include: {
        subtipo: {
          include: {
            tipoRiesgo: true
          }
        }
      }
    });

    res.status(201).json(tipologia);
  } catch (error: any) {
    console.error('Error al crear tipología extendida:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Ya existe una tipología con ese nombre y nivel' 
      });
    }
    
    res.status(500).json({ error: 'Error al crear tipología extendida' });
  }
};

/**
 * PUT /api/catalogos/tipologias-extendidas/:id
 * Actualiza una tipología extendida
 */
export const actualizarTipologiaExtendida = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { nombre, descripcion, activo, subtipoId } = req.body;

    // Verificar que existe
    const tipologiaExistente = await prisma.tipologiaRiesgoExtendida.findUnique({
      where: { id }
    });

    if (!tipologiaExistente) {
      return res.status(404).json({ error: 'Tipología no encontrada' });
    }

    // Preparar datos de actualización
    const data: any = {};
    if (nombre !== undefined) data.nombre = nombre.trim();
    if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null;
    if (activo !== undefined) data.activo = Boolean(activo);
    if (subtipoId !== undefined) data.subtipoId = subtipoId ? Number(subtipoId) : null;

    // Actualizar
    const tipologia = await prisma.tipologiaRiesgoExtendida.update({
      where: { id },
      data,
      include: {
        subtipo: {
          include: {
            tipoRiesgo: true
          }
        }
      }
    });

    res.json(tipologia);
  } catch (error: any) {
    console.error('Error al actualizar tipología extendida:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Ya existe una tipología con ese nombre y nivel' 
      });
    }
    
    res.status(500).json({ error: 'Error al actualizar tipología extendida' });
  }
};

/**
 * DELETE /api/catalogos/tipologias-extendidas/:id
 * Elimina una tipología extendida (solo si no está en uso)
 */
export const eliminarTipologiaExtendida = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // Verificar que existe
    const tipologiaExistente = await prisma.tipologiaRiesgoExtendida.findUnique({
      where: { id }
    });

    if (!tipologiaExistente) {
      return res.status(404).json({ error: 'Tipología no encontrada' });
    }

    // Verificar si está en uso
    const enUso = await prisma.riesgo.count({
      where: {
        OR: [
          { tipologiaTipo3Id: id },
          { tipologiaTipo4Id: id }
        ]
      }
    });

    if (enUso > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar porque está en uso por ${enUso} riesgo(s)`,
        riesgosAfectados: enUso
      });
    }

    // Eliminar
    await prisma.tipologiaRiesgoExtendida.delete({
      where: { id }
    });

    res.json({ 
      success: true,
      message: 'Tipología eliminada correctamente' 
    });
  } catch (error) {
    console.error('Error al eliminar tipología extendida:', error);
    res.status(500).json({ error: 'Error al eliminar tipología extendida' });
  }
};

/**
 * GET /api/catalogos/tipologias-extendidas/por-subtipo/:subtipoId
 * Obtiene tipologías extendidas por subtipo
 */
export const obtenerTipologiasPorSubtipo = async (req: Request, res: Response) => {
  try {
    const subtipoId = Number(req.params.subtipoId);
    const { nivel } = req.query;

    const where: any = {
      subtipoId,
      activo: true
    };

    if (nivel) {
      where.nivel = Number(nivel);
    }

    const tipologias = await prisma.tipologiaRiesgoExtendida.findMany({
      where,
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }]
    });

    res.json(tipologias);
  } catch (error) {
    console.error('Error al obtener tipologías por subtipo:', error);
    res.status(500).json({ error: 'Error al obtener tipologías por subtipo' });
  }
};
