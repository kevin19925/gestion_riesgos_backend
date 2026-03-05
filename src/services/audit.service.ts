/**
 * Servicio de Auditoría
 * Maneja el registro y consulta de cambios en el sistema
 */

import prisma from '../prisma';

// Tipos
export interface RegistroAuditoriaInput {
  usuarioId: number;
  usuarioNombre: string;
  usuarioEmail: string;
  usuarioRole: string;
  accion: 'CREATE' | 'UPDATE' | 'DELETE';
  tabla: string;
  registroId?: number;
  registroDesc?: string;
  cambios?: Record<string, { anterior: any; nuevo: any }>;
  datosAnteriores?: any;
  datosNuevos?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface FiltrosAuditoria {
  usuarioId?: number;
  tabla?: string;
  accion?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  page?: number;
  pageSize?: number;
}

// Mapeo de rutas a nombres de tablas
const RUTA_A_TABLA: Record<string, string> = {
  '/api/riesgos': 'Riesgo',
  '/api/procesos': 'Proceso',
  '/api/usuarios': 'Usuario',
  '/api/incidencias': 'Incidencia',
  '/api/planes-accion': 'PlanAccion',
  '/api/evaluaciones': 'EvaluacionRiesgo',
  '/api/priorizaciones': 'PriorizacionRiesgo',
  '/api/causas': 'CausaRiesgo',
  '/api/controles-riesgo': 'ControlRiesgo',
  '/api/controles': 'Control',
  '/api/areas': 'Area',
  '/api/roles': 'Role',
  '/api/cargos': 'Cargo',
  '/api/gerencias': 'Gerencia',
  '/api/observaciones': 'Observacion',
  '/api/normatividades': 'Normatividad',
  '/api/contextos': 'Contexto',
  '/api/dofa': 'DofaItem',
  '/api/benchmarking': 'Benchmarking',
};

/**
 * Registra un evento de auditoría
 */
export async function registrarAuditoria(datos: RegistroAuditoriaInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: datos.usuarioId,
        usuarioNombre: datos.usuarioNombre,
        usuarioEmail: datos.usuarioEmail,
        usuarioRole: datos.usuarioRole,
        accion: datos.accion,
        tabla: datos.tabla,
        registroId: datos.registroId,
        registroDesc: datos.registroDesc,
        cambios: datos.cambios as any,
        datosAnteriores: datos.datosAnteriores as any,
        datosNuevos: datos.datosNuevos as any,
        ipAddress: datos.ipAddress,
        userAgent: datos.userAgent,
      },
    });
  } catch (error) {
    // No lanzar error para no afectar la operación principal
    console.error('Error registrando auditoría:', error);
  }
}

/**
 * Obtiene el historial de auditoría con filtros y paginación
 */
export async function obtenerHistorial(filtros: FiltrosAuditoria) {
  const page = filtros.page || 1;
  const pageSize = filtros.pageSize || 50;
  const skip = (page - 1) * pageSize;

  // Construir filtros de Prisma
  const where: any = {};

  if (filtros.usuarioId) {
    where.usuarioId = filtros.usuarioId;
  }

  if (filtros.tabla) {
    where.tabla = filtros.tabla;
  }

  if (filtros.accion) {
    where.accion = filtros.accion;
  }

  if (filtros.fechaDesde || filtros.fechaHasta) {
    where.createdAt = {};
    if (filtros.fechaDesde) {
      where.createdAt.gte = filtros.fechaDesde;
    }
    if (filtros.fechaHasta) {
      // Agregar 1 día para incluir todo el día
      const fechaHastaFin = new Date(filtros.fechaHasta);
      fechaHastaFin.setDate(fechaHastaFin.getDate() + 1);
      where.createdAt.lt = fechaHastaFin;
    }
  }

  // Consultar con paginación
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Obtiene un registro de auditoría por ID
 */
export async function obtenerLogPorId(id: number) {
  return await prisma.auditLog.findUnique({
    where: { id },
  });
}

/**
 * Obtiene estadísticas de auditoría
 */
export async function obtenerEstadisticas() {
  const [total, creaciones, actualizaciones, eliminaciones] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { accion: 'CREATE' } }),
    prisma.auditLog.count({ where: { accion: 'UPDATE' } }),
    prisma.auditLog.count({ where: { accion: 'DELETE' } }),
  ]);

  return {
    totalRegistros: total,
    creaciones,
    actualizaciones,
    eliminaciones,
  };
}

/**
 * Calcula los cambios entre dos objetos
 */
export function calcularCambios(
  anterior: any,
  nuevo: any
): Record<string, { anterior: any; nuevo: any }> | null {
  if (!anterior || !nuevo) return null;

  const cambios: Record<string, { anterior: any; nuevo: any }> = {};
  const todasLasClaves = new Set([
    ...Object.keys(anterior),
    ...Object.keys(nuevo),
  ]);

  for (const clave of todasLasClaves) {
    // Ignorar campos de timestamp y IDs de auditoría
    if (['createdAt', 'updatedAt', 'id'].includes(clave)) continue;

    const valorAnterior = anterior[clave];
    const valorNuevo = nuevo[clave];

    // Comparar valores (incluyendo objetos y arrays)
    if (JSON.stringify(valorAnterior) !== JSON.stringify(valorNuevo)) {
      cambios[clave] = {
        anterior: valorAnterior,
        nuevo: valorNuevo,
      };
    }
  }

  return Object.keys(cambios).length > 0 ? cambios : null;
}

/**
 * Obtiene una descripción legible del registro según la tabla
 */
export function obtenerDescripcionRegistro(tabla: string, datos: any): string {
  if (!datos) return '';

  switch (tabla) {
    case 'Riesgo':
      return `${datos.numeroIdentificacion || datos.numero} - ${datos.descripcion?.substring(0, 50) || ''}`;

    case 'Proceso':
      return datos.nombre || '';

    case 'Usuario':
      return `${datos.nombre} (${datos.email})`;

    case 'Incidencia':
      return datos.codigo || datos.titulo || '';

    case 'PlanAccion':
      return datos.nombre || datos.descripcion?.substring(0, 50) || '';

    case 'EvaluacionRiesgo':
      return `Evaluación - Riesgo ID: ${datos.riesgoId}`;

    case 'PriorizacionRiesgo':
      return `Priorización - Riesgo ID: ${datos.riesgoId}`;

    case 'CausaRiesgo':
      return datos.descripcion?.substring(0, 50) || '';

    case 'Area':
      return datos.nombre || '';

    case 'Role':
      return `${datos.codigo} - ${datos.nombre}`;

    case 'Cargo':
      return datos.nombre || '';

    case 'Gerencia':
      return datos.nombre || '';

    case 'Observacion':
      return datos.texto?.substring(0, 50) || '';

    case 'Normatividad':
      return datos.nombre || '';

    case 'Contexto':
      return `${datos.tipo}: ${datos.descripcion?.substring(0, 40) || ''}`;

    case 'DofaItem':
      return `${datos.tipo}: ${datos.descripcion?.substring(0, 40) || ''}`;

    case 'Benchmarking':
      return datos.entidad || datos.empresa || '';

    default:
      return datos.nombre || datos.descripcion?.substring(0, 50) || `ID: ${datos.id}`;
  }
}

/**
 * Obtiene el nombre de la tabla desde la ruta de la API
 */
export function obtenerTablaDesdeRuta(ruta: string): string | null {
  // Limpiar la ruta (quitar query params y trailing slash)
  const rutaLimpia = ruta.split('?')[0].replace(/\/$/, '');

  // Buscar coincidencia exacta
  if (RUTA_A_TABLA[rutaLimpia]) {
    return RUTA_A_TABLA[rutaLimpia];
  }

  // Buscar coincidencia parcial (para rutas con ID, ej: /api/riesgos/123)
  for (const [rutaBase, tabla] of Object.entries(RUTA_A_TABLA)) {
    if (rutaLimpia.startsWith(rutaBase)) {
      return tabla;
    }
  }

  return null;
}

/**
 * Obtiene la acción desde el método HTTP
 */
export function obtenerAccionDesdeMetodo(metodo: string): 'CREATE' | 'UPDATE' | 'DELETE' | null {
  switch (metodo.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return null;
  }
}
