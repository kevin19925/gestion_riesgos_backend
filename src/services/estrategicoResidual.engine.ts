/**
 * Motor residual CWR / Anexo 6 (hoja 3. Evaluación).
 * Paridad con otros/analisis/2/anexo6-cwr-formula-tests/src/excelEngine.js
 * Parametrizable vía StrategicEngineConfig (persistido en admin).
 */

export function excelRoundUp0(x: number): number {
  if (x === 0 || Object.is(x, -0)) return 0;
  const sign = x > 0 ? 1 : -1;
  return sign * Math.ceil(Math.abs(x) - 1e-12);
}

/** Igual que en Excel Anexo 6: solo estas AZ activan el 0,34 sobre la dimensión cruzada (no «Medianamente», etc.). */
function foldAscii(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const AZ_FACTOR_CRUZADO_EXCEL = new Set(
  [foldAscii('Altamente Efectiva'), foldAscii('Efectiva')]
);

export function aplicaFactorMitigacionCruzadaExcel(AZ: string): boolean {
  return AZ_FACTOR_CRUZADO_EXCEL.has(foldAscii(String(AZ ?? '').trim()));
}

function clampEjeResidual15(n: number): number {
  return Math.max(1, Math.min(5, n));
}

/** Rango sobre AY (0–1) → etiqueta AZ. */
export interface StrategicRangoAz {
  etiqueta: string;
  min: number;
  max: number;
  incluirMin: boolean;
  incluirMax: boolean;
}

export interface StrategicBaRow {
  etiquetaAz: string;
  ba: number;
}

export interface StrategicEngineConfig {
  /**
   * IDs de Tipología tipo I (TipoRiesgo) permitidos en identificación cuando el proceso es residual estratégico.
   * Vacío = usar heurística por nombre (contiene "estratég" / "estrateg" sin depender de acentos).
   */
  tipologiaTipo1IdsEstrategia: number[];
  /** Peso aplicado a cada uno de los 5 criterios MA (típico 0,2). */
  pesoPorCriterio: number;
  presupuesto: Record<string, number>;
  actitud: Record<string, number>;
  /** Capacitación, documentación y monitoreo (SI / NO / PARCIAL). */
  capacitacionDocMon: Record<string, number>;
  rangosAz: StrategicRangoAz[];
  tablaBa: StrategicBaRow[];
  /** Factor usado en ramas “cruzadas” IMPACTO/FRECUENCIA + AZ Altamente/Efectiva (típico 0,34). */
  factorMitigacionCruzada: number;
  bdEspecialBb: number;
  bdEspecialBc: number;
  bdEspecialResultado: number;
  /**
   * Lista histórica en JSON admin; la fórmula Excel Anexo 6 aplica el factor cruzado solo si AZ es
   * «Altamente Efectiva» o «Efectiva» (ver `aplicaFactorMitigacionCruzadaExcel`).
   */
  etiquetasAzMitigacionCruzada: string[];
}

export const DEFAULT_STRATEGIC_ENGINE_CONFIG: StrategicEngineConfig = {
  /** Vacío: en identificación se usan tipologías tipo I heurísticas “estratégicas”; si se llenan, solo esos IDs. */
  tipologiaTipo1IdsEstrategia: [],
  pesoPorCriterio: 0.2,
  presupuesto: { SI: 1, NO: 0, PARCIAL: 0.4 },
  actitud: { POSITIVA: 1, RENUENTE: 0, NEUTRAL: 0.8 },
  capacitacionDocMon: { SI: 1, NO: 0, PARCIAL: 0.4 },
  rangosAz: [
    { etiqueta: 'Inefectiva', min: 0, max: 0.2, incluirMin: true, incluirMax: false },
    { etiqueta: 'Baja Efectividad', min: 0.2, max: 0.33, incluirMin: true, incluirMax: false },
    { etiqueta: 'Medianamente Efectiva', min: 0.33, max: 0.61, incluirMin: true, incluirMax: false },
    { etiqueta: 'Efectiva', min: 0.61, max: 0.8, incluirMin: true, incluirMax: false },
    { etiqueta: 'Altamente Efectiva', min: 0.8, max: 1, incluirMin: true, incluirMax: true },
  ],
  tablaBa: [
    { etiquetaAz: 'Altamente Efectiva', ba: 0.8 },
    { etiquetaAz: 'Efectiva', ba: 0.61 },
    { etiquetaAz: 'Medianamente Efectiva', ba: 0.33 },
    { etiquetaAz: 'Baja Efectividad', ba: 0.2 },
    { etiquetaAz: 'Inefectiva', ba: 0 },
  ],
  factorMitigacionCruzada: 0.34,
  bdEspecialBb: 2,
  bdEspecialBc: 2,
  bdEspecialResultado: 3.99,
  etiquetasAzMitigacionCruzada: ['Altamente Efectiva', 'Efectiva'],
};

function deepCloneConfig(c: StrategicEngineConfig): StrategicEngineConfig {
  return JSON.parse(JSON.stringify(c)) as StrategicEngineConfig;
}

/** Fusiona JSON guardado con valores por defecto (claves y tablas incompletas). */
export function mergeStrategicEngineConfig(partial: unknown): StrategicEngineConfig {
  const d = deepCloneConfig(DEFAULT_STRATEGIC_ENGINE_CONFIG);
  if (!partial || typeof partial !== 'object') return d;
  const p = partial as Record<string, unknown>;

  if (Array.isArray(p.tipologiaTipo1IdsEstrategia)) {
    const ids = p.tipologiaTipo1IdsEstrategia
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((x) => Number.isFinite(x) && x > 0)
      .map((x) => Math.floor(Number(x)));
    d.tipologiaTipo1IdsEstrategia = [...new Set(ids)];
  }

  if (typeof p.pesoPorCriterio === 'number' && p.pesoPorCriterio > 0 && p.pesoPorCriterio <= 0.5) {
    d.pesoPorCriterio = p.pesoPorCriterio;
  }
  if (typeof p.factorMitigacionCruzada === 'number' && p.factorMitigacionCruzada >= 0 && p.factorMitigacionCruzada <= 1) {
    d.factorMitigacionCruzada = p.factorMitigacionCruzada;
  }
  if (typeof p.bdEspecialBb === 'number' && p.bdEspecialBb >= 0) d.bdEspecialBb = p.bdEspecialBb;
  if (typeof p.bdEspecialBc === 'number' && p.bdEspecialBc >= 0) d.bdEspecialBc = p.bdEspecialBc;
  if (typeof p.bdEspecialResultado === 'number' && p.bdEspecialResultado >= 0) d.bdEspecialResultado = p.bdEspecialResultado;

  if (Array.isArray(p.etiquetasAzMitigacionCruzada) && p.etiquetasAzMitigacionCruzada.length > 0) {
    const tags = p.etiquetasAzMitigacionCruzada.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    if (tags.length > 0) d.etiquetasAzMitigacionCruzada = tags;
  }

  const mergeNumRecord = (base: Record<string, number>, src: unknown): void => {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (typeof v === 'number' && v >= 0 && v <= 1.0001) base[k] = Math.min(1, v);
    }
  };
  mergeNumRecord(d.presupuesto, p.presupuesto);
  mergeNumRecord(d.actitud, p.actitud);
  mergeNumRecord(d.capacitacionDocMon, p.capacitacionDocMon);

  if (Array.isArray(p.rangosAz) && p.rangosAz.length > 0) {
    const rangos: StrategicRangoAz[] = [];
    for (const r of p.rangosAz) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      const etiqueta = typeof o.etiqueta === 'string' ? o.etiqueta.trim() : '';
      if (!etiqueta) continue;
      const min = typeof o.min === 'number' ? o.min : 0;
      const max = typeof o.max === 'number' ? o.max : 1;
      rangos.push({
        etiqueta,
        min,
        max,
        incluirMin: o.incluirMin !== false,
        incluirMax: o.incluirMax === true,
      });
    }
    if (rangos.length > 0) d.rangosAz = rangos;
  }

  if (Array.isArray(p.tablaBa) && p.tablaBa.length > 0) {
    const rows: StrategicBaRow[] = [];
    for (const r of p.tablaBa) {
      if (!r || typeof r !== 'object') continue;
      const o = r as Record<string, unknown>;
      const etiquetaAz = typeof o.etiquetaAz === 'string' ? o.etiquetaAz.trim() : '';
      if (!etiquetaAz) continue;
      const ba = typeof o.ba === 'number' ? Math.max(0, Math.min(1, o.ba)) : 0;
      rows.push({ etiquetaAz, ba });
    }
    if (rows.length > 0) d.tablaBa = rows;
  }

  return d;
}

function vlookupPresupuesto(ao: string, cfg: StrategicEngineConfig): number {
  return cfg.presupuesto[ao] ?? NaN;
}

function vlookupActitud(aq: string, cfg: StrategicEngineConfig): number {
  return cfg.actitud[aq] ?? NaN;
}

function vlookupSiNoParcial(x: string, cfg: StrategicEngineConfig): number {
  return cfg.capacitacionDocMon[x] ?? NaN;
}

export function calcPuntajeMedida(
  AP: number,
  AR: number,
  AT: number,
  AV: number,
  AX: number,
  cfg: StrategicEngineConfig
): number {
  const w = cfg.pesoPorCriterio;
  return w * AP + w * AR + w * AT + w * AV + w * AX;
}

export function calcEvaluacionMedidaAZ(ay: number, cfg: StrategicEngineConfig): string {
  const sorted = [...cfg.rangosAz].sort((a, b) => a.min - b.min);
  for (const r of sorted) {
    const geMin = r.incluirMin ? ay >= r.min : ay > r.min;
    const leMax = r.incluirMax ? ay <= r.max : ay < r.max;
    if (geMin && leMax) return r.etiqueta;
  }
  return sorted.length > 0 ? sorted[sorted.length - 1].etiqueta : 'ERROR';
}

export function calcBA(az: string, cfg: StrategicEngineConfig): number {
  const row = cfg.tablaBa.find((r) => r.etiquetaAz === az);
  if (!row) return NaN;
  return row.ba;
}

export function calcResidualFreqBB(AN: string, AZ: string, R: number, BA: number, cfg: StrategicEngineConfig): number {
  const f = cfg.factorMitigacionCruzada;
  const useCross = aplicaFactorMitigacionCruzadaExcel(AZ);
  let inner: number;
  if (AN === 'FRECUENCIA' || AN === 'AMBAS') {
    inner = R - BA * R;
  } else if (AN === 'IMPACTO' && useCross) {
    inner = R - R * f;
  } else {
    inner = R;
  }
  try {
    return clampEjeResidual15(excelRoundUp0(inner));
  } catch {
    return clampEjeResidual15(R);
  }
}

export function calcResidualImpactBC(AN: string, AZ: string, Y: number, BA: number, cfg: StrategicEngineConfig): number {
  const f = cfg.factorMitigacionCruzada;
  const useCross = aplicaFactorMitigacionCruzadaExcel(AZ);
  let inner: number;
  if (AN === 'IMPACTO' || AN === 'AMBAS') {
    inner = Y - Y * BA;
  } else if (AN === 'FRECUENCIA' && useCross) {
    inner = Y - Y * f;
  } else {
    inner = Y;
  }
  try {
    return clampEjeResidual15(excelRoundUp0(inner));
  } catch {
    return clampEjeResidual15(Y);
  }
}

export function calcResidualCauseBD(BB: number, BC: number, cfg: StrategicEngineConfig): number {
  if (BB === cfg.bdEspecialBb && BC === cfg.bdEspecialBc) return cfg.bdEspecialResultado;
  return BB * BC;
}

const POS_LABEL = 'Riesgo con consecuencia positiva';

export function calcEvalResidualFinalBF(L: string, AK: number, BE: number): number {
  if (L === POS_LABEL) return AK;
  return BE;
}

export interface StrategicRowInput {
  R: number;
  Y: number;
  AN: string;
  presupuesto: string;
  actitud: string;
  cap: string;
  doc: string;
  mon: string;
  clasificacionRiesgo: string;
  /** Valor AK del Excel para riesgos positivos; aquí se usa riesgoInherente. */
  akPositivo: number;
}

export interface StrategicRowResult {
  AY: number;
  AZ: string;
  BA: number;
  BB: number;
  BC: number;
  BD: number;
  BF: number;
}

/** Normaliza etiquetas MA a las claves del motor. */
export function normalizarMaOpcionSiNo(s: string | null | undefined): string | null {
  if (s == null || String(s).trim() === '') return null;
  const u = String(s).trim().toUpperCase();
  if (u === 'SI' || u === 'NO' || u === 'PARCIAL') return u;
  return null;
}

export function normalizarMaActitud(s: string | null | undefined): string | null {
  if (s == null || String(s).trim() === '') return null;
  const u = String(s).trim().toUpperCase();
  if (u === 'POSITIVA' || u === 'RENUENTE' || u === 'NEUTRAL') return u;
  return null;
}

export function normalizarTipoMitigacionAnexo(s: string | null | undefined): string | null {
  if (s == null || String(s).trim() === '') return null;
  const u = String(s).trim().toUpperCase();
  if (u === 'FRECUENCIA' || u === 'IMPACTO' || u === 'AMBAS') return u;
  return null;
}

/**
 * Calcula BB, BC, BD para una medida MA completa.
 * Retorna null si faltan datos obligatorios.
 */
export function computeStrategicResidualRow(
  input: StrategicRowInput,
  cfg: StrategicEngineConfig = DEFAULT_STRATEGIC_ENGINE_CONFIG
): StrategicRowResult | null {
  const AN = normalizarTipoMitigacionAnexo(input.AN);
  const ao = normalizarMaOpcionSiNo(input.presupuesto);
  const aq = normalizarMaActitud(input.actitud);
  const as = normalizarMaOpcionSiNo(input.cap);
  const au = normalizarMaOpcionSiNo(input.doc);
  const aw = normalizarMaOpcionSiNo(input.mon);

  if (!AN || !ao || !aq || !as || !au || !aw) return null;

  const R = Math.max(1, Math.min(5, Math.round(input.R)));
  const Y = Math.max(1, Math.min(5, Math.round(input.Y)));

  const AP = vlookupPresupuesto(ao, cfg);
  const AR = vlookupActitud(aq, cfg);
  const AT = vlookupSiNoParcial(as, cfg);
  const AV = vlookupSiNoParcial(au, cfg);
  const AX = vlookupSiNoParcial(aw, cfg);

  if ([AP, AR, AT, AV, AX].some((n) => Number.isNaN(n))) return null;

  const AY = calcPuntajeMedida(AP, AR, AT, AV, AX, cfg);
  const AZ = calcEvaluacionMedidaAZ(AY, cfg);
  const BA = calcBA(AZ, cfg);
  if (Number.isNaN(BA)) return null;

  const BB = calcResidualFreqBB(AN, AZ, R, BA, cfg);
  const BC = calcResidualImpactBC(AN, AZ, Y, BA, cfg);
  const BD = calcResidualCauseBD(BB, BC, cfg);
  const BF = calcEvalResidualFinalBF(input.clasificacionRiesgo || '', input.akPositivo, BD);

  return { AY, AZ, BA, BB, BC, BD, BF };
}
