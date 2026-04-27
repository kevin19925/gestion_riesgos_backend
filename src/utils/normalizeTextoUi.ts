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
  // Em dash (—) corrupto (diversas variaciones)
  [/\?\u2014\u2014/g, '\u2014'],
  [/\?\u2014/g, '\u2014'],
  [/\?\u2013/g, '\u2013'],
  [/\?\uFFFD\uFFFD/g, ' \u2014 '], // ? -> — 
  [/\u00e2\u20ac\u201c/g, '\u2014'],
  [/\u00e2\u20ac\u201d/g, '\u2013'],

  // Comité
  [/Comit\uFFFD\?/gi, 'Comité'],
  [/Comit\uFFFD\?\s+Comercial/gi, 'Comité Comercial'],
  [/Comit\uFFFD\s+Comercial/gi, 'Comité Comercial'],
  [/Comit\?\s+Comercial/gi, 'Comité Comercial'],
  [/\bComite\s+Comercial\b/gi, 'Comité Comercial'],
  [/\bComitee\b/gi, 'Comité'],

  // Política / política
  [/Pol\uFFFDtica/gi, 'Política'],
  [/Pol\?tica/gi, 'Política'],
  [/\bPoltica\b/gi, 'Política'],

  // Metodología
  [/metodolog\uFFFDa/gi, 'metodología'],
  [/metodolog\?a/gi, 'metodología'],
  [/\bmetodologa\b/gi, 'metodología'],

  // Módulo
  [/m\uFFFDdulo/gi, 'módulo'],
  [/\bmdulo\b/gi, 'módulo'],

  // Dirección
  [/Direcci\uFFFDn/gi, 'Dirección'],
  [/\bDireccin\b/gi, 'Dirección'],

  // Seguimiento
  [/seguimient\uFFFD/gi, 'seguimiento'],
  [/seguimient\?/gi, 'seguimiento'],

  // Régimen
  [/R\uFFFD\?gimen/gi, 'Régimen'],
  [/R\uFFFDgimen/gi, 'Régimen'],
  [/R\?gimen/gi, 'Régimen'],
  [/\bRgimen\b/gi, 'Régimen'],

  // Décima
  [/D\uFFFD\?cima/gi, 'Décima'],
  [/D\uFFFDcima/gi, 'Décima'],
  [/D\?cima/gi, 'Décima'],

  // Orgánica
  [/Ley\?\uFFFD\uFFFDOrg\uFFFDnica/gi, 'Ley Orgánica'],
  [/Ley\?\uFFFD\uFFFDOrgánica/gi, 'Ley Orgánica'],
  [/Ley\?Orgánica/gi, 'Ley Orgánica'],
  [/Org\uFFFDnica/gi, 'Orgánica'],

  // Sección / sección
  [/Secci\uFFFDn/gi, 'Sección'],
  [/Secci\?n/gi, 'Sección'],
  [/\bSeccin\b/gi, 'Sección'],

  // Artículo
  [/Art\uFFFDculo/gi, 'Artículo'],
  [/Art\?culo/gi, 'Artículo'],
  [/\bArtculo\b/gi, 'Artículo'],

  // Obligación / obligación
  [/Obligaci\uFFFDn/gi, 'Obligación'],
  [/Obligaci\?n/gi, 'Obligación'],
  [/\bObligacin\b/gi, 'Obligación'],

  // Aplicación
  [/Aplicaci\uFFFDn/gi, 'Aplicación'],
  [/Aplicaci\?n/gi, 'Aplicación'],
  [/\bAplicacin\b/gi, 'Aplicación'],

  // Función / función
  [/Funci\uFFFDn/gi, 'Función'],
  [/Funci\?n/gi, 'Función'],
  [/\bFuncin\b/gi, 'Función'],

  // Información
  [/Informaci\uFFFDn/gi, 'Información'],
  [/Informaci\?n/gi, 'Información'],
  [/\bInformacin\b/gi, 'Información'],

  // Evaluación
  [/Evaluaci\uFFFDn/gi, 'Evaluación'],
  [/Evaluaci\?n/gi, 'Evaluación'],
  [/\bEvaluacin\b/gi, 'Evaluación'],

  // Administración
  [/Administraci\uFFFDn/gi, 'Administración'],
  [/Administraci\?n/gi, 'Administración'],

  // Relación
  [/Relaci\uFFFDn/gi, 'Relación'],
  [/Relaci\?n/gi, 'Relación'],

  // Revisión
  [/Revisi\uFFFDn/gi, 'Revisión'],
  [/Revisi\?n/gi, 'Revisión'],

  // Gestión
  [/Gesti\uFFFDn/gi, 'Gestión'],
  [/Gesti\?n/gi, 'Gestión'],

  // Resolución
  [/Resoluci\uFFFDn/gi, 'Resolución'],
  [/Resoluci\?n/gi, 'Resolución'],

  // Sanción
  [/Sanci\uFFFDn/gi, 'Sanción'],
  [/Sanci\?n/gi, 'Sanción'],

  // Prevención
  [/Prevenci\uFFFDn/gi, 'Prevención'],
  [/Prevenci\?n/gi, 'Prevención'],

  // Protección
  [/Protecci\uFFFDn/gi, 'Protección'],
  [/Protecci\?n/gi, 'Protección'],

  // Contribución / contribución
  [/Contribuci\uFFFDn/gi, 'Contribución'],
  [/Contribuci\?n/gi, 'Contribución'],

  // Depreciación / amortización
  [/Depreciaci\uFFFDn/gi, 'Depreciación'],
  [/Depreciaci\?n/gi, 'Depreciación'],
  [/Amortizaci\uFFFDn/gi, 'Amortización'],
  [/Amortizaci\?n/gi, 'Amortización'],

  // Retención
  [/Retenci\uFFFDn/gi, 'Retención'],
  [/Retenci\?n/gi, 'Retención'],

  // Supervisión
  [/Supervisi\uFFFDn/gi, 'Supervisión'],
  [/Supervisi\?n/gi, 'Supervisión'],

  // Comunicación
  [/Comunicaci\uFFFDn/gi, 'Comunicación'],
  [/Comunicaci\?n/gi, 'Comunicación'],

  // Verificación
  [/Verificaci\uFFFDn/gi, 'Verificación'],
  [/Verificaci\?n/gi, 'Verificación'],

  // Declaración
  [/Declaraci\uFFFDn/gi, 'Declaración'],
  [/Declaraci\?n/gi, 'Declaración'],

  // Palabras comunes con tilde afectadas
  [/trav\uFFFD\?s/gi, 'través'],
  [/trav\uFFFDs/gi, 'través'],
  [/d\uFFFD\?ficit/gi, 'déficit'],
  [/d\uFFFDficit/gi, 'déficit'],
  [/tambi\uFFFD\?n/gi, 'también'],
  [/tambi\uFFFDn/gi, 'también'],
  [/\binter\uFFFD+\?s\b/gi, 'interés'],
  [/\binter\?s\b/gi, 'interés'],
  [/\binter\uFFFDs\b/gi, 'interés'],
  [/estrat\uFFFD\?gic[oa]s?/gi, 'estratégico'],
  [/estrat\uFFFDgic[oa]s?/gi, 'estratégico'],

  // Otro
  [/\bcon los establecido\b/gi, 'con lo establecido'],
];

const SPANISH_CATALOG_FIXES: Array<[RegExp, string]> = [
  [/\bEstrat\?gico\b/gi, 'Estratégico'],
  [/\bEstrat\uFFFDgico\b/gi, 'Estratégico'],
  [/\bEstrat\uFFFD\?gico\b/gi, 'Estratégico'],
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

const PERSON_NAME_GLITCH_FIXES: Array<[RegExp, string]> = [
  [/\bJos[\?\uFFFD]+\b/g, 'José'],
  [/\bJos\uFFFD\b/g, 'José'],
  [/\bJos\?\b/g, 'José'],
  [/\bMar[\?\uFFFD]+a\b/g, 'María'],
  [/\bMar\uFFFDa\b/g, 'María'],
  [/\bMar\?a\b/g, 'María'],
  [/\bGonz[\?\uFFFD]+lez\b/gi, 'González'],
  [/\bGonz\uFFFDlez\b/gi, 'González'],
  [/\bGonz\?lez\b/gi, 'González'],
  [/\bP[\?\uFFFD]+rez\b/gi, 'Pérez'],
  [/\bP\uFFFDrez\b/gi, 'Pérez'],
  [/\bP\?rez\b/gi, 'Pérez'],
  [/\bRodr[\?\uFFFD]+guez\b/gi, 'Rodríguez'],
  [/\bRodr\uFFFDguez\b/gi, 'Rodríguez'],
  [/\bRodr\?guez\b/gi, 'Rodríguez'],
  [/\bMaldonad[\?\uFFFD]+\b/gi, 'Maldonado'],
  [/\bMaldonad\uFFFD\b/gi, 'Maldonado'],
  [/\bMaldonad\?\b/gi, 'Maldonado'],
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
  for (const [re, rep] of PERSON_NAME_GLITCH_FIXES) {
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
