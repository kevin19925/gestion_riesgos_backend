/**
 * Repara texto corrupto (mojibake, signos inválidos) en la tabla Normatividad.
 *
 * Dry run (solo reporte):  npx tsx scripts/repair-normatividad.ts
 * Aplicar cambios:         npx tsx scripts/repair-normatividad.ts --apply
 */
import prisma from '../src/prisma';
import { fullTextSanitize } from '../src/utils/normalizeTextoUi';

const TEXT_FIELDS = [
  'nombre', 'regulador', 'sanciones', 'plazoImplementacion',
  'detalleIncumplimiento', 'riesgoIdentificado', 'comentarios', 'responsable',
] as const;

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Modo: ${apply ? '✅ APLICAR CAMBIOS' : '🔍 DRY RUN (solo reporte)'}\n`);

  // Leer todos los registros de Normatividad
  const registros = await prisma.normatividad.findMany({
    select: {
      id: true,
      procesoId: true,
      numero: true,
      nombre: true,
      regulador: true,
      sanciones: true,
      plazoImplementacion: true,
      detalleIncumplimiento: true,
      riesgoIdentificado: true,
      comentarios: true,
      responsable: true,
    },
  });

  console.log(`Total registros Normatividad: ${registros.length}\n`);

  // Mostrar registros que parecen tener problemas para diagnosticarlos
  const sospechosos = registros.filter(r => 
    (r.nombre && r.nombre.includes('?')) || 
    (r.sanciones && r.sanciones.includes('?')) ||
    (r.riesgoIdentificado && r.riesgoIdentificado.includes('?')) ||
    (r.nombre && r.nombre.includes('Régimen')) ||
    (r.nombre && r.nombre.includes('Rgimen')) ||
    (r.nombre && r.nombre.includes('gimen'))
  );

  console.log(`Registros sospechosos encontrados: ${sospechosos.length}`);
  if (sospechosos.length > 0) {
    console.log(JSON.stringify(sospechosos.map(s => ({id: s.id, nombre: s.nombre})), null, 2));
  }

  let totalAfectados = 0;

  for (const reg of registros) {
    const updates: Partial<Record<typeof TEXT_FIELDS[number], string>> = {};

    for (const field of TEXT_FIELDS) {
      const val = reg[field];
      if (typeof val === 'string' && val.length > 0) {
        const fixed = fullTextSanitize(val);
        if (fixed !== val) {
          updates[field] = fixed;
          console.log(`  [id=${reg.id} procesoId=${reg.procesoId} #${reg.numero}] "${field}"`);
          console.log(`    ANTES:   ${JSON.stringify(val.slice(0, 200))}`);
          console.log(`    DESPUÉS: ${JSON.stringify(fixed.slice(0, 200))}`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      totalAfectados++;
      if (apply) {
        await prisma.normatividad.update({
          where: { id: reg.id },
          data: updates,
        });
        console.log(`    → ✅ Actualizado\n`);
      } else {
        console.log(`    → (no aplicado - dry run)\n`);
      }
    }
  }

  console.log('\n── Resumen ─────────────────────────────────────');
  console.log(`Registros escaneados:  ${registros.length}`);
  console.log(`Registros afectados:   ${totalAfectados}`);
  if (!apply && totalAfectados > 0) {
    console.log('\n→ Ejecute con --apply para escribir los cambios en la BD.');
  }
  if (totalAfectados === 0) {
    console.log('No se encontraron textos a reparar.');
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
