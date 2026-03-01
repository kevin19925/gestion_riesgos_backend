/**
 * Elimina solo las tablas Notificacion y Tarea. No toca el resto de la base.
 * Uso: npx tsx scripts/drop-notificacion-tarea.ts
 */
import prisma from '../src/prisma';

async function main() {
  console.log('Eliminando solo tablas Notificacion y Tarea...');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "Tarea"');
  console.log('  - Tabla Tarea eliminada (si existía).');
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "Notificacion"');
  console.log('  - Tabla Notificacion eliminada (si existía).');
  console.log('Listo. El resto de la base no se ha tocado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
