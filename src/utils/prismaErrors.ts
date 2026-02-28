/**
 * Mensajes de error personalizados para operaciones Prisma (eliminar, etc.)
 * P2003 = Foreign key constraint / registros asociados
 * P2025 = Record not found
 */

export type PrismaClientKnownRequestError = { code?: string; meta?: Record<string, unknown> };

export function getDeleteErrorMessage(
  error: unknown,
  entityName: string,
  dependencias?: string
): string {
  const e = error as PrismaClientKnownRequestError;
  if (e?.code === 'P2025') {
    return `No se encontró el ${entityName} o ya fue eliminado.`;
  }
  if (e?.code === 'P2003') {
    const msg = dependencias
      ? `No se puede eliminar el ${entityName} porque tiene ${dependencias} asociados.`
      : `No se puede eliminar el ${entityName} porque tiene registros asociados en otras tablas.`;
    return msg;
  }
  return `Error al eliminar ${entityName}.`;
}
