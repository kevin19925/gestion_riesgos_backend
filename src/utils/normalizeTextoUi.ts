export const PROBLEMATIC_TEXT_PATTERN =
  /[\u00ab\u00bb\u201c\u201d\u2018\u2019\u200b\u200e\u200f\ufeff\u00a0]/;

const LOOKS_LIKE_UTF8_MOJIBAKE = /Ã.|Â.|â€|Â¿|Â¡|\uFFFD/;

export function repairUtf8Mojibake(input: string | null | undefined): string {
  if (input == null) return '';
  if (typeof input !== 'string' || input.length === 0) return input;
  if (!LOOKS_LIKE_UTF8_MOJIBAKE.test(input)) return input;
  try {
    const bytes = Uint8Array.from(input, (c) => c.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (decoded && decoded !== input && !decoded.includes('\uFFFD')) return decoded;
  } catch {
    /* ignore */
  }
  return input;
}

const ENCODING_GLITCH_FIXES: Array<[RegExp, string]> = [
  [/Comit\uFFFD\?\s+Comercial/gi, 'Comité Comercial'],
  [/Comit\uFFFD\s+Comercial/gi, 'Comité Comercial'],
  [/Comit\?\s+Comercial/gi, 'Comité Comercial'],
  [/\bComite\s+Comercial\b/gi, 'Comité Comercial'],
  [/\bComitee\b/gi, 'Comité'],
  [/Pol\uFFFDtica/gi, 'Política'],
  [/Pol\?tica/gi, 'Política'],
  [/\bPoltica\b/gi, 'Política'],
  [/metodolog\uFFFDa/gi, 'metodología'],
  [/metodolog\?a/gi, 'metodología'],
  [/\bmetodologa\b/gi, 'metodología'],
  [/m\uFFFDdulo/gi, 'módulo'],
  [/\bmdulo\b/gi, 'módulo'],
  [/Direcci\uFFFDn/gi, 'Dirección'],
  [/\bDireccin\b/gi, 'Dirección'],
  [/\bcon los establecido\b/gi, 'con lo establecido'],
  [/seguimient\uFFFD/gi, 'seguimiento'],
  [/seguimient\?/gi, 'seguimiento'],
];

const SPANISH_CATALOG_FIXES: Array<[RegExp, string]> = [
  [/\bEstrat\?gico\b/gi, 'Estratégico'],
  [/\bEstrat\uFFFDgico\b/gi, 'Estratégico'],
  [/\bEstratgico\b/gi, 'Estratégico'],
  [/\bprdidas\b/gi, 'pérdidas'],
  [/\bprdida\b/gi, 'pérdida'],
  [/[Pp]\?rdidas\b/g, 'pérdidas'],
  [/[Pp]\?rdida\b/g, 'pérdida'],
  [/[Pp]\uFFFDrdidas\b/g, 'pérdidas'],
  [/[Pp]\uFFFDrdida\b/g, 'pérdida'],
  [/\bGestin\b/gi, 'Gestión'],
  [/\bPosicin\b/gi, 'Posición'],
];

export function hasProblematicText(s: string | null | undefined): boolean {
  if (s == null || typeof s !== 'string') return false;
  return PROBLEMATIC_TEXT_PATTERN.test(s);
}

export function normalizeTextoUi(s: string): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\ufeff/g, '')
    .replace(/[\u200b\u200e\u200f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ab/g, '"')
    .replace(/\u00bb/g, '"')
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");
}

export function repairEncodingGlitches(s: string): string {
  let t = s;
  for (const [re, rep] of ENCODING_GLITCH_FIXES) {
    t = t.replace(re, rep);
  }
  return t;
}

export function repairSpanishCatalogText(s: string): string {
  let t = s;
  for (const [re, rep] of SPANISH_CATALOG_FIXES) {
    t = t.replace(re, rep);
  }
  return t;
}

export function fullTextSanitize(s: string): string {
  let t = String(s);
  t = repairUtf8Mojibake(t);
  t = repairEncodingGlitches(t);
  t = normalizeTextoUi(t);
  t = repairSpanishCatalogText(t);
  return t;
}

export function needsTextSanitize(s: string): boolean {
  return fullTextSanitize(s) !== s;
}
