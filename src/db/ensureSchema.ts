import prisma from '../prisma';

/**
 * Asegura columnas nuevas sin borrar datos.
 * Esto evita 500 si el entorno no ejecutó migraciones aún.
 *
 * Nota: usamos SQL idempotente (IF NOT EXISTS).
 */
export async function ensureSchema(): Promise<void> {
  // PlanAccion: seguimiento tras fecha de finalización (URLs en blob)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "fechaFinalizacion" TIMESTAMP(3);
    ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "seguimientoDetalle" TEXT;
    ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "seguimientoEvidenciaUrl1" TEXT;
    ALTER TABLE "PlanAccion" ADD COLUMN IF NOT EXISTS "seguimientoEvidenciaUrl2" TEXT;
  `);
}

