/**
 * Pruebas del cálculo de impacto y frecuencia residual (BY, BZ, CA).
 * Alineado con Excel: BY/BZ 1..5, CA = BY×BZ salvo 2×2 → 3.99.
 * Ejecutar: npx tsx scripts/pruebas-recalculo-residual.ts
 */

import {
  calcularFrecuenciaResidual,
  calcularImpactoResidual
} from '../src/services/recalculoResidual.service';

const DIM_CRUZ = 0.34;

function calificacionResidual(by: number, bz: number): number {
  if (by === 2 && bz === 2) return 3.99;
  return by * bz;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK: ${msg}`);
  return true;
}

function runTests() {
  console.log('--- Frecuencia residual (BY) ---\n');

  // FRECUENCIA o AMBAS: reduce por porcentaje mitigación
  const by1 = calcularFrecuenciaResidual(5, 0.4, 'AMBAS', 'Efectivo', DIM_CRUZ);
  assert(by1 === 3, `BY: freq=5, 40% mitigación AMBAS → ceil(3)=3 (got ${by1})`);

  const by2 = calcularFrecuenciaResidual(4, 0.34, 'FRECUENCIA', 'Altamente Efectivo', DIM_CRUZ);
  assert(by2 === 3, `BY: freq=4, 34% FRECUENCIA → ceil(2.64)=3 (got ${by2})`);

  // IMPACTO + Efectivo: reduce por dimensión cruzada 34%
  const by3 = calcularFrecuenciaResidual(5, 0.5, 'IMPACTO', 'Efectivo', DIM_CRUZ);
  assert(by3 === 4, `BY: freq=5, control IMPACTO Efectivo → ceil(5*0.66)=4 (got ${by3})`);

  // IMPACTO + Inefectivo: no reduce frecuencia
  const by4 = calcularFrecuenciaResidual(4, 0.5, 'IMPACTO', 'Inefectivo', DIM_CRUZ);
  assert(by4 === 4, `BY: control IMPACTO Inefectivo → sin cambio (got ${by4})`);

  // Cota 1..5
  const by5 = calcularFrecuenciaResidual(1, 0.9, 'AMBAS', 'Efectivo', DIM_CRUZ);
  assert(by5 === 1, `BY: resultado acotado mínimo 1 (got ${by5})`);

  console.log('\n--- Impacto residual (BZ) ---\n');

  // IMPACTO o AMBAS: reduce por porcentaje mitigación
  const bz1 = calcularImpactoResidual(5, 0.4, 'AMBAS', 'Efectivo', DIM_CRUZ);
  assert(bz1 === 3, `BZ: impacto=5, 40% AMBAS → ceil(3)=3 (got ${bz1})`);

  const bz2 = calcularImpactoResidual(4, 0.34, 'IMPACTO', 'Altamente Efectivo', DIM_CRUZ);
  assert(bz2 === 3, `BZ: impacto=4, 34% IMPACTO → ceil(2.64)=3 (got ${bz2})`);

  // FRECUENCIA + Efectivo: reduce impacto por dimensión cruzada 34%
  const bz3 = calcularImpactoResidual(5, 0.5, 'FRECUENCIA', 'Efectivo', DIM_CRUZ);
  assert(bz3 === 4, `BZ: impacto=5, control FRECUENCIA Efectivo → ceil(3.3)=4 (got ${bz3})`);

  // FRECUENCIA + Inefectivo: no reduce impacto
  const bz4 = calcularImpactoResidual(4, 0.5, 'FRECUENCIA', 'Inefectivo', DIM_CRUZ);
  assert(bz4 === 4, `BZ: control FRECUENCIA Inefectivo → sin cambio (got ${bz4})`);

  const bz5 = calcularImpactoResidual(1, 0.9, 'AMBAS', 'Efectivo', DIM_CRUZ);
  assert(bz5 === 1, `BZ: resultado acotado mínimo 1 (got ${bz5})`);

  console.log('\n--- Calificación residual (CA) y causa ganadora ---\n');

  assert(calificacionResidual(2, 2) === 3.99, 'CA: 2×2 → 3.99');
  assert(calificacionResidual(2, 3) === 6, 'CA: 2×3 = 6');
  assert(calificacionResidual(3, 2) === 6, 'CA: 3×2 = 6');
  assert(calificacionResidual(5, 5) === 25, 'CA: 5×5 = 25');

  // Simular agregación por riesgo: causa con mayor CA gana; mapa usa su BY y BZ
  const causas = [
    { by: 3, bz: 2, ca: calificacionResidual(3, 2) },
    { by: 2, bz: 2, ca: calificacionResidual(2, 2) },
    { by: 4, bz: 2, ca: calificacionResidual(4, 2) },
  ];
  const ganadora = causas.reduce((max, c) => (c.ca > max.ca ? c : max));
  assert(ganadora.by === 4 && ganadora.bz === 2 && ganadora.ca === 8,
    `Causa ganadora: max CA → BY=4, BZ=2, CA=8 (got BY=${ganadora.by} BZ=${ganadora.bz} CA=${ganadora.ca})`);

  // Cuando hay empate en CA, el primero con ese max debería usarse (comportamiento actual: primer max)
  const causas2 = [
    { by: 2, bz: 2, ca: 3.99 },
    { by: 3, bz: 2, ca: 6 },
  ];
  const g2 = causas2.reduce((max, c) => (c.ca > max.ca ? c : max));
  assert(g2.ca === 6 && g2.by === 3 && g2.bz === 2, 'Causa ganadora con 6 > 3.99');

  console.log('\n--- Todos los controles: tipos FRECUENCIA / IMPACTO / AMBAS ---\n');

  const tipos: Array<'FRECUENCIA' | 'IMPACTO' | 'AMBAS'> = ['FRECUENCIA', 'IMPACTO', 'AMBAS'];
  for (const tipo of tipos) {
    const by = calcularFrecuenciaResidual(4, 0.34, tipo, 'Efectivo', DIM_CRUZ);
    const bz = calcularImpactoResidual(4, 0.34, tipo, 'Efectivo', DIM_CRUZ);
    const ca = calificacionResidual(by, bz);
    assert(by >= 1 && by <= 5 && bz >= 1 && bz <= 5, `Tipo ${tipo}: BY=${by}, BZ=${bz}, CA=${ca} dentro de rango`);
  }

  console.log('\nPruebas de recálculo residual finalizadas.');
}

runTests();
