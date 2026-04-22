/**
 * Escanear y opcionalmente corregir texto en columnas varchar/text (guillemets, comillas curvas, NBSP, etc.).
 * Dry run (solo informe): npx tsx scripts/normalizar-texto-bd.ts
 * Aplicar cambios:           npx tsx scripts/normalizar-texto-bd.ts --apply
 */
import prisma from '../src/prisma';
import { applyTextNormalization } from './lib/scanTextoBd';

async function main() {
  const apply = process.argv.includes('--apply');
  const r = await applyTextNormalization(prisma, { dryRun: !apply, limitRowsPerColumn: 50_000 });
  console.log(
    JSON.stringify(
      {
        dryRun: !apply,
        scannedCells: r.scannedCells,
        updatedCells: r.updatedCells,
        cellsNeedingFix: r.hitsBefore.length,
        sample: r.hitsBefore.slice(0, 25),
      },
      null,
      2
    )
  );
  if (r.hitsBefore.length && !apply) {
    console.log('\nPara escribir en BD ejecute con --apply');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
