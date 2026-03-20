import { Request, Response } from 'express';
import { procesarMensajeIA, procesarMensajeIAStream } from '../services/ia.service';
import prisma from '../prisma';

export const postChatIA = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: number; email: string; role?: string } | undefined;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado', message: 'Usuario no autenticado' });
    }

    const { message, conversationId } = req.body || {};

    // Obtener el nombre real del usuario y su cargo desde la base de datos
    const dbUser = await prisma.usuario.findUnique({ 
      where: { id: Number(user.userId) }, 
      select: { 
        nombre: true, 
        cargo: { select: { nombre: true } },
        procesosResponsablesMultiples: {
          select: { modo: true },
        },
      } 
    });
    const displayName = dbUser?.nombre || (user.email && user.email.includes('@') ? user.email.split('@')[0] : user.email);
    const cargoNombre = dbUser?.cargo?.nombre || user.role || 'Usuario';

    // Rol "de negocio" para la IA: si es dueño de procesos (director), indicarlo claramente.
    const tieneProcesosComoDueno =
      dbUser?.procesosResponsablesMultiples?.some((r: any) => String(r.modo || '').toLowerCase() === 'director') ?? false;

    let iaRol: string;
    if (tieneProcesosComoDueno) {
      iaRol = 'Dueño de procesos (director de procesos)';
    } else {
      // Mapear códigos técnicos a etiquetas más legibles
      const codigo = (user.role || '').toLowerCase();
      if (codigo === 'admin') iaRol = 'Administrador del sistema';
      else if (codigo === 'gerente') iaRol = 'Gerente';
      else if (codigo === 'supervisor') iaRol = 'Supervisor';
      else if (codigo === 'dueño_procesos') iaRol = 'Dueño de procesos';
      else iaRol = user.role || 'Usuario';
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'El campo message es requerido' });
    }

    const result = await procesarMensajeIA({
      userId: String(user.userId),
      userName: displayName,
      rol: iaRol,
      cargo: cargoNombre,
      message: message.trim(),
      conversationId: conversationId ? String(conversationId) : undefined,
    });

    return res.json({
      conversationId: result.conversationId,
      answer: result.answer,
    });
  } catch (error: any) {
    console.error('[IA] Error crítico en postChatIA:', error);
    if (error.response) {
      console.error('[IA] Data de error de respuesta de OpenAI (si aplica):', error.response.data);
    }
    return res.status(500).json({
      error: 'Error al procesar el mensaje de IA',
      message: error?.message || 'Error desconocido',
      details: process.env.NODE_ENV === 'production' ? undefined : (error?.stack || String(error)),
    });
  }
};

export const postChatIAStream = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: number; email: string; role?: string } | undefined;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado', message: 'Usuario no autenticado' });
    }

    const { message, conversationId, screenContext } = req.body || {}; // NUEVO: screenContext

    console.log('[IA Controller] screenContext recibido:', JSON.stringify(screenContext, null, 2)); // DEBUG

    const dbUser = await prisma.usuario.findUnique({
      where: { id: Number(user.userId) },
      select: {
        nombre: true,
        cargo: { select: { nombre: true } },
        procesosResponsablesMultiples: {
          select: { modo: true },
        },
      },
    });
    const displayName =
      dbUser?.nombre ||
      (user.email && user.email.includes('@') ? user.email.split('@')[0] : user.email);
    const cargoNombre = dbUser?.cargo?.nombre || user.role || 'Usuario';

    const tieneProcesosComoDueno =
      dbUser?.procesosResponsablesMultiples?.some((r: any) => String(r.modo || '').toLowerCase() === 'director') ?? false;

    let iaRol: string;
    if (tieneProcesosComoDueno) {
      iaRol = 'Dueño de procesos (director de procesos)';
    } else {
      const codigo = (user.role || '').toLowerCase();
      if (codigo === 'admin') iaRol = 'Administrador del sistema';
      else if (codigo === 'gerente') iaRol = 'Gerente';
      else if (codigo === 'supervisor') iaRol = 'Supervisor';
      else if (codigo === 'dueño_procesos') iaRol = 'Dueño de procesos';
      else iaRol = user.role || 'Usuario';
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'El campo message es requerido' });
    }

    // Configuramos cabeceras SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let finished = false;

    const sendEvent = (event: string | null, data: unknown) => {
      if (finished) return;
      if (event) {
        res.write(`event: ${event}\n`);
      }
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      (res as any).flush?.();
    };

    // Arrancamos el procesamiento en streaming
    procesarMensajeIAStream(
      {
        userId: String(user.userId),
        userName: displayName,
        rol: iaRol,
        cargo: cargoNombre,
        message: message.trim(),
        conversationId: conversationId ? String(conversationId) : undefined,
        screenContext, // NUEVO: Pasar contexto de pantalla
      },
      (chunk) => {
        sendEvent(null, { delta: chunk });
      },
    )
      .then((result) => {
        finished = true;
        sendEvent('end', {
          conversationId: result.conversationId,
        });
        res.end();
      })
      .catch((error: any) => {
        console.error('[IA] Error crítico en postChatIAStream:', error);
        finished = true;
        sendEvent('error', {
          error: 'Error al procesar el mensaje de IA',
          message: error?.message || 'Error desconocido',
        });
        res.end();
      });
  } catch (error: any) {
    console.error('[IA] Error crítico en postChatIAStream (bloque externo):', error);
    return res.status(500).json({
      error: 'Error al procesar el mensaje de IA',
      message: error?.message || 'Error desconocido',
    });
  }
};

export const getConversaciones = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    // Ensure we await dynamic imports or use the exported functions
    const { obtenerConversacionesUsuario } = await import('../services/ia.service');
    const conversaciones = await obtenerConversacionesUsuario(String(user.userId));
    
    return res.json(conversaciones);
  } catch (error: any) {
    console.error('[IA] Error en getConversaciones:', error);
    return res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
};

export const getConversacionDetail = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { obtenerConversacion } = await import('../services/ia.service');
    const conversacion = await obtenerConversacion(id, String(user.userId));
    
    if (!conversacion) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    
    return res.json({
      id: conversacion._id.toString(),
      messages: conversacion.messages || [],
      updatedAt: conversacion.updatedAt
    });
  } catch (error: any) {
    console.error('[IA] Error en getConversacionDetail:', error);
    return res.status(500).json({ error: 'Error al obtener detalle de conversación' });
  }
};

export const deleteConversacion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { eliminarConversacion } = await import('../services/ia.service');
    const success = await eliminarConversacion(id, String(user.userId));
    
    return res.json({ success });
  } catch (error: any) {
    console.error('[IA] Error en deleteConversacion:', error);
    return res.status(500).json({ error: 'Error al eliminar conversación' });
  }
};

export const renameConversacion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { title } = req.body;
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    if (!title) return res.status(400).json({ error: 'El título es requerido' });

    const { renombrarConversacion } = await import('../services/ia.service');
    const success = await renombrarConversacion(id, String(user.userId), title);
    
    return res.json({ success });
  } catch (error: any) {
    console.error('[IA] Error en renameConversacion:', error);
    return res.status(500).json({ error: 'Error al renombrar conversación' });
  }
};
