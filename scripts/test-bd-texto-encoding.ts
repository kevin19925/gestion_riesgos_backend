/**
 * Falla (exit 1) si hay texto con guillemets, comillas tipográficas o invisibles en columnas texto.
 * Sin DATABASE_URL hace skip (exit 0). Ejecutar: npx tsx scripts/test-bd-texto-encoding.ts
 */
import prisma from '../src/prisma';
import { collectTextColumnsAndScan } from './lib/scanTextoBd';

async function main() {
  const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '').trim();
  if (!url) {
    console.log('test-bd-texto-encoding: SKIP (sin DATABASE_URL)');
    return;
  }

  const hits = await collectTextColumnsAndScan(prisma, { limitRowsPerColumn: 50_000 });
  if (hits.length > 0) {
    console.error(`test-bd-texto-encoding: ${hits.length} celda(s) con caracteres problemáticos:`);
    for (const h of hits.slice(0, 80)) {
      console.error(`  ${h.table}.${h.column} pk=${JSON.stringify(h.pk)} preview=${JSON.stringify(h.preview)}`);
    }
    if (hits.length > 80) console.error(`  ... y ${hits.length - 80} más`);
    process.exitCode = 1;
    return;
  }
  console.log('test-bd-texto-encoding: OK (sin coincidencias)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
