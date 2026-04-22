/**
 * Ejecutar: npx tsx scripts/recalcular-estrategicos-once.ts
 * Recalcula residual CWR para todos los riesgos en procesos modo ESTRATEGICO.
 */
import prisma from '../src/prisma';
import { recalcularTodosRiesgosEstrategicos } from '../src/services/estrategicoResidual.service';

async function main() {
  const r = await recalcularTodosRiesgosEstrategicos();
  console.log('OK:', JSON.stringify(r, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
