/**
 * Paridad con fixtures de anexo6-cwr-formula-tests (fila 12 golden).
 * Ejecutar: npx tsx scripts/test-estrategico-engine.ts
 */
import assert from 'assert';
import {
  computeStrategicResidualRow,
  calcResidualFreqBB,
  calcResidualImpactBC,
  calcResidualCauseBD,
  DEFAULT_STRATEGIC_ENGINE_CONFIG,
} from '../src/services/estrategicoResidual.engine';

const row = computeStrategicResidualRow({
  R: 5,
  Y: 4,
  AN: 'IMPACTO',
  presupuesto: 'SI',
  actitud: 'POSITIVA',
  cap: 'SI',
  doc: 'SI',
  mon: 'SI',
  clasificacionRiesgo: 'Riesgo con consecuencia negativa',
  akPositivo: 0,
});

assert(row, 'fila completa MA');
assert.strictEqual(row!.AY, 1);
assert.strictEqual(row!.AZ, 'Altamente Efectiva');
assert.strictEqual(row!.BA, 0.8);
assert.strictEqual(row!.BB, 4);
assert.strictEqual(row!.BC, 1);
assert.strictEqual(row!.BD, 4);
assert.strictEqual(row!.BF, 4);

// Excel: solo «Altamente Efectiva» y «Efectiva» activan 0,34 en la dimensión cruzada (no «Medianamente»).
assert.strictEqual(
  calcResidualFreqBB('IMPACTO', 'Medianamente Efectiva', 5, 0.33, DEFAULT_STRATEGIC_ENGINE_CONFIG),
  5
);
assert.strictEqual(
  calcResidualImpactBC('FRECUENCIA', 'Medianamente Efectiva', 4, 0.33, DEFAULT_STRATEGIC_ENGINE_CONFIG),
  4
);

// Caso especial BD: BB=2, BC=2 -> 3,99
const bb = 2;
const bc = 2;
assert.strictEqual(calcResidualCauseBD(bb, bc, DEFAULT_STRATEGIC_ENGINE_CONFIG), 3.99);

console.log('estrategicoResidual.engine: row12 golden OK');
