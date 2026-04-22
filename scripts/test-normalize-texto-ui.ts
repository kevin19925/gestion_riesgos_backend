import assert from 'node:assert/strict';
import {
  fullTextSanitize,
  hasProblematicText,
  normalizeTextoUi,
  PROBLEMATIC_TEXT_PATTERN,
} from '../src/utils/normalizeTextoUi';

assert.equal(normalizeTextoUi('a\u00abb\u00bbc'), 'a"b"c');
assert.equal(normalizeTextoUi('\u201cHola\u201d'), '"Hola"');
assert.equal(normalizeTextoUi('\u2018x\u2019'), "'x'");
assert.equal(normalizeTextoUi('x\u200by'), 'xy');
assert.equal(normalizeTextoUi('a\u00a0b'), 'a b');
assert.equal(fullTextSanitize('Estrat?gico'), 'Estratégico');
assert.equal(fullTextSanitize('Estrat\uFFFDgico'), 'Estratégico');
assert.equal(fullTextSanitize('ESTRATEGICO'), 'ESTRATEGICO');
assert.equal(fullTextSanitize('direccionamiento estratégico'), 'direccionamiento estratégico');
assert.equal(
  fullTextSanitize('Comit\uFFFD? Comercial con Pol\uFFFDtica'),
  'Comité Comercial con Política'
);
assert.equal(
  fullTextSanitize('de conformidad con los establecido en'),
  'de conformidad con lo establecido en'
);
assert.equal(hasProblematicText('«x»'), true);
assert.equal(hasProblematicText('ok'), false);
assert.match('«', PROBLEMATIC_TEXT_PATTERN);

console.log('test-normalize-texto-ui.ts: OK');
