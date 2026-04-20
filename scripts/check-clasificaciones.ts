/**
 * Script de diagnóstico: muestra clasificaciones de riesgos en la BD
 * Ejecutar con: npx ts-node scripts/check-clasificaciones.ts
 */
import prisma from '../src/prisma';

async function main() {
  console.log('\n=== DIAGNÓSTICO: CLASIFICACIONES DE RIESGOS ===\n');

  // 1. Todos los valores DISTINTOS de clasificacion en la BD
  const clasificaciones = await (prisma as any).$queryRaw`
    SELECT clasificacion, COUNT(*) as total
    FROM "Riesgo"
    GROUP BY clasificacion
    ORDER BY total DESC
  `;
  console.log('Valores de clasificacion en BD:');
  console.table(clasificaciones);

  // 2. Los 10 riesgos más recientes con su clasificacion
  const recientes = await (prisma as any).$queryRaw`
    SELECT id, "numeroIdentificacion", clasificacion, "procesoId", "createdAt"
    FROM "Riesgo"
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;
  console.log('\nÚltimos 10 riesgos creados:');
  console.table(recientes);

  // 3. Todos los riesgos con clasificacion POSITIVA
  const positivos = await (prisma as any).$queryRaw`
    SELECT id, "numeroIdentificacion", descripcion, clasificacion, "procesoId"
    FROM "Riesgo"
    WHERE clasificacion = 'Riesgo con consecuencia positiva'
    LIMIT 20
  `;
  console.log('\nRiesgos con clasificacion = "Riesgo con consecuencia positiva":');
  console.table(positivos);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
