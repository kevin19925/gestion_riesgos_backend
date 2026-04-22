/**
 * Aserciones sin BD: misma regla que update/create proceso (solo ESTANDAR | ESTRATEGICO).
 * Ejecutar: node scripts/test-residual-modo-normalize.mjs
 */
import assert from 'node:assert/strict';

function normalizeResidualModo(raw) {
  if (raw === undefined || raw === null) return undefined;
  const m = String(raw).trim().toUpperCase();
  if (m === 'ESTANDAR' || m === 'ESTRATEGICO') return m;
  return undefined;
}

assert.equal(normalizeResidualModo('estrategico'), 'ESTRATEGICO');
assert.equal(normalizeResidualModo(' ESTANDAR '), 'ESTANDAR');
assert.equal(normalizeResidualModo('invalid'), undefined);
assert.equal(normalizeResidualModo(undefined), undefined);

console.log('test-residual-modo-normalize.mjs: OK');
