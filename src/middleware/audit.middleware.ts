/**
 * Middleware de Auditoría
 * Captura automáticamente los cambios en el sistema
 */

import { Request, Response, NextFunction } from 'express';
import * as auditService from '../services/audit.service';
import prisma from '../prisma';

/**
 * Middleware que registra automáticamente las operaciones de auditoría
 */
export function auditMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Solo auditar operaciones de modificación
    const metodosAuditables = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!metodosAuditables.includes(req.method)) {
      return next();
    }

    // Verificar que el usuario esté autenticado
    const user = (req as any).user;
    if (!user || !user.userId) {
      return next();
    }

    // Obtener la tabla desde la ruta
    const tabla = auditService.obtenerTablaDesdeRuta(req.path);
    if (!tabla) {
      // No es una ruta auditable
      return next();
    }

    // Obtener la acción
    const accion = auditService.obtenerAccionDesdeMetodo(req.method);
    if (!accion) {
      return next();
    }

    // Obtener datos del usuario
    let usuarioNombre = 'Usuario Desconocido';
    let usuarioEmail = user.email || 'sin-email@sistema.com';
    let usuarioRole = user.role || 'sin-rol';

    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: user.userId },
        select: {
          nombre: true,
          email: true,
          role: {
            select: { codigo: true },
          },
        },
      });

      if (usuario) {
        usuarioNombre = usuario.nombre;
        usuarioEmail = usuario.email;
        usuarioRole = usuario.role?.codigo || usuarioRole;
      }
    } catch (error) {
      console.error('Error obteniendo datos del usuario para auditoría:', error);
    }

    // Capturar datos anteriores para UPDATE y DELETE
    let datosAnteriores: any = null;
    
    // Obtener el ID de la URL (puede estar en params o en la ruta)
    let registroId: number | null = null;
    
    // Intentar obtener de req.params primero
    if (req.params.id) {
      registroId = Number(req.params.id);
    } 
    // Si no está en params, intentar extraer de la URL
    else {
      const match = req.path.match(/\/(\d+)(?:\/|$)/);
      if (match && match[1]) {
        registroId = Number(match[1]);
      }
    }

    console.log('🔍 [AUDIT] Verificando si obtener datos anteriores:', {
      accion,
      registroId,
      path: req.path,
      params: req.params,
      tieneId: !!registroId,
      esUpdateODelete: accion === 'UPDATE' || accion === 'DELETE',
    });

    if ((accion === 'UPDATE' || accion === 'DELETE') && registroId) {
      console.log('📥 [AUDIT] Obteniendo datos anteriores para:', tabla, registroId);
      try {
        // Intentar obtener el registro anterior
        datosAnteriores = await obtenerRegistroAnterior(tabla, registroId);
        console.log('✅ [AUDIT] Datos anteriores obtenidos:', datosAnteriores ? 'Sí' : 'No');
        if (datosAnteriores) {
          console.log('📄 [AUDIT] Campos en datos anteriores:', Object.keys(datosAnteriores).length);
        }
      } catch (error) {
        console.error('❌ [AUDIT] Error obteniendo datos anteriores:', error);
      }
    }

    // Interceptar la respuesta para capturar los datos nuevos
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Solo registrar si la operación fue exitosa (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('✅ [AUDIT] Respuesta exitosa, registrando auditoría...');
        
        // Ejecutar el registro de auditoría de forma asíncrona (no bloqueante)
        setImmediate(async () => {
          try {
            const registroIdFinal = registroId || body?.id || body?.data?.id;
            const datosNuevos = body?.data || body;

            console.log('📝 [AUDIT] Datos a registrar:', {
              usuario: usuarioNombre,
              accion,
              tabla,
              registroId: registroIdFinal,
            });

            // Calcular cambios para UPDATE
            let cambios = null;
            if (accion === 'UPDATE' && datosAnteriores && datosNuevos) {
              cambios = auditService.calcularCambios(datosAnteriores, datosNuevos);
              console.log('🔄 [AUDIT] Cambios detectados:', cambios ? Object.keys(cambios).length : 0);
              
              // Si no hay cambios, no registrar auditoría
              if (!cambios || Object.keys(cambios).length === 0) {
                console.log('⏭️ [AUDIT] No hay cambios, saltando registro de auditoría');
                return;
              }
            }

            // Obtener descripción del registro
            const registroDesc = auditService.obtenerDescripcionRegistro(
              tabla,
              datosNuevos || datosAnteriores
            );

            // Registrar auditoría
            await auditService.registrarAuditoria({
              usuarioId: user.userId,
              usuarioNombre,
              usuarioEmail,
              usuarioRole,
              accion,
              tabla,
              registroId: registroIdFinal,
              registroDesc,
              cambios: cambios || undefined,
              datosAnteriores: accion === 'DELETE' ? datosAnteriores : undefined,
              datosNuevos: accion === 'CREATE' ? datosNuevos : undefined,
              ipAddress: obtenerIP(req),
              userAgent: req.get('user-agent'),
            });
            
            console.log('✅ [AUDIT] Auditoría registrada exitosamente');
          } catch (error) {
            // No lanzar error para no afectar la respuesta al cliente
            console.error('❌ [AUDIT] Error registrando auditoría:', error);
          }
        });
      } else {
        console.log('⚠️ [AUDIT] Respuesta no exitosa, no se registra:', res.statusCode);
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Obtiene el registro anterior de la base de datos
 */
async function obtenerRegistroAnterior(tabla: string, id: number): Promise<any> {
  const tablasPrisma: Record<string, any> = {
    Riesgo: prisma.riesgo,
    Proceso: prisma.proceso,
    Usuario: prisma.usuario,
    Incidencia: prisma.incidencia,
    PlanAccion: prisma.planAccion,
    EvaluacionRiesgo: prisma.evaluacionRiesgo,
    PriorizacionRiesgo: prisma.priorizacionRiesgo,
    CausaRiesgo: prisma.causaRiesgo,
    ControlRiesgo: prisma.controlRiesgo,
    Control: prisma.control,
    Area: prisma.area,
    Role: prisma.role,
    Cargo: prisma.cargo,
    Gerencia: prisma.gerencia,
    Observacion: prisma.observacion,
    Normatividad: prisma.normatividad,
    Contexto: prisma.contexto,
    DofaItem: prisma.dofaItem,
    Benchmarking: prisma.benchmarking,
  };

  const modelo = tablasPrisma[tabla];
  if (!modelo) {
    return null;
  }

  try {
    return await modelo.findUnique({ where: { id } });
  } catch (error) {
    console.error(`Error obteniendo registro anterior de ${tabla}:`, error);
    return null;
  }
}

/**
 * Obtiene la dirección IP del cliente
 */
function obtenerIP(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'IP desconocida'
  );
}
