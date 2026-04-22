/**
 * Restaura Proceso id=11 (referencia seed). Otros nombres: npm run normalizar:texto-bd -- --apply
 * npx tsx scripts/repair-proceso-11-codigos.ts
 */
import prisma from '../src/prisma';

async function main() {
  const p = await prisma.proceso.findUnique({ where: { id: 11 } });
  if (!p) {
    console.log('Proceso 11 no existe; omitido.');
    return;
  }
  await prisma.proceso.update({
    where: { id: 11 },
    data: {
      residualModo: 'ESTRATEGICO',
      nombre: 'Gestión Estratégica',
      descripcion: 'Gestión del direccionamiento estratégico',
      objetivo: 'Definir y dirigir la estrategia organizacional.',
    },
  });
  console.log('Proceso 11: residualModo, nombre, descripcion y objetivo restaurados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
