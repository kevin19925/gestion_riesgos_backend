/**
 * Aplica el procedimiento almacenado recalcular_residuales_completo() en la base de datos.
 * Úsalo si el recálculo sigue yendo por Node (no por BD): normalmente pasa cuando
 * usas `prisma db push` y la migración con el procedimiento no se ejecutó.
 *
 * Uso: npx tsx scripts/aplicar-procedimiento-residual.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import prisma from '../src/prisma';

async function main() {
  const migrationPath = path.join(__dirname, '../prisma/migrations/20250224120000_recalcular_residual_en_bd/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Quitar solo comentarios al inicio (líneas que empiezan con --)
  const sqlLimpio = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();

  console.log('Aplicando procedimiento almacenado recalcular_residuales_completo()...');
  try {
    await prisma.$executeRawUnsafe(sqlLimpio);
    console.log('OK: Función creada o actualizada.');
  } catch (e: any) {
    console.error('Error al ejecutar el SQL:', e?.message || e);
    process.exit(1);
  }

  // Verificar que la función existe
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ routine_name: string }>>(
      `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'recalcular_residuales_completo'`
    );
    if (rows?.length) {
      console.log('Verificación: función recalcular_residuales_completo() instalada. El próximo "Recalcular" desde el admin usará la BD.');
    } else {
      console.warn('No se encontró la función en information_schema (puede ser normal). Prueba "Recalcular" desde el admin.');
    }
  } catch (e: any) {
    console.warn('No se pudo verificar:', e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
