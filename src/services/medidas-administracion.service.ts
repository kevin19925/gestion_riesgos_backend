/**
 * Servicio de Cálculo - Medidas de Administración
 * 
 * Calcula la evaluación de efectividad de las medidas de administración
 * para riesgos positivos (oportunidades estratégicas).
 * 
 * Fórmula: AY = Σ(campo × 0.2) para los 5 criterios evaluados
 */

// Valores de puntaje para cada campo
const PUNTAJES: Record<string, Record<string, number>> = {
  presupuesto: {
    'Si': 1.0,
    'Parcial': 0.4,
    'No': 0.0,
  },
  stakeholders: {
    'Positiva': 1.0,
    'Neutral': 0.8,
    'Negativa': 0.0,
  },
  entrenamiento: {
    'Si': 1.0,
    'Parcial': 0.4,
    'No': 0.0,
  },
  politicas: {
    'Si': 1.0,
    'Parcial': 0.4,
    'No': 0.0,
  },
  monitoreo: {
    'Si': 1.0,
    'Parcial': 0.4,
    'No': 0.0,
  },
};

const PESO = 0.2; // Cada campo tiene el mismo peso

/**
 * Calcula el puntaje de un campo específico
 */
export function calcularPuntajeCampo(campo: string, valor: string | null | undefined): number {
  if (!valor) return 0;
  return PUNTAJES[campo]?.[valor] ?? 0;
}

/**
 * Determina la clasificación de efectividad y el factor de reducción
 * según el puntaje total AY
 */
function determinarEvaluacion(ay: number): { evaluacion: string; factorReduccion: number } {
  if (ay >= 0.80) return { evaluacion: 'Altamente Efectiva', factorReduccion: 0.66 };
  if (ay >= 0.61) return { evaluacion: 'Efectiva', factorReduccion: 0.50 };
  if (ay >= 0.33) return { evaluacion: 'Medianamente Efectiva', factorReduccion: 0.25 };
  if (ay >= 0.20) return { evaluacion: 'Baja Efectividad', factorReduccion: 0.10 };
  return { evaluacion: 'Inefectiva', factorReduccion: 0.0 };
}

export interface DatosMedida {
  presupuesto?: string | null;
  stakeholders?: string | null;
  entrenamiento?: string | null;
  politicas?: string | null;
  monitoreo?: string | null;
}

export interface ResultadoEvaluacion {
  puntajePresupuesto: number;
  puntajeStakeholders: number;
  puntajeEntrenamiento: number;
  puntajePoliticas: number;
  puntajeMonitoreo: number;
  puntajeTotal: number;
  evaluacion: string;
  factorReduccion: number;
}

/**
 * Calcula la evaluación completa de una medida de administración
 */
export function calcularEvaluacionMedida(datos: DatosMedida): ResultadoEvaluacion {
  const puntajePresupuesto = calcularPuntajeCampo('presupuesto', datos.presupuesto);
  const puntajeStakeholders = calcularPuntajeCampo('stakeholders', datos.stakeholders);
  const puntajeEntrenamiento = calcularPuntajeCampo('entrenamiento', datos.entrenamiento);
  const puntajePoliticas = calcularPuntajeCampo('politicas', datos.politicas);
  const puntajeMonitoreo = calcularPuntajeCampo('monitoreo', datos.monitoreo);

  const puntajeTotal = parseFloat((
    puntajePresupuesto * PESO +
    puntajeStakeholders * PESO +
    puntajeEntrenamiento * PESO +
    puntajePoliticas * PESO +
    puntajeMonitoreo * PESO
  ).toFixed(2));

  const { evaluacion, factorReduccion } = determinarEvaluacion(puntajeTotal);

  return {
    puntajePresupuesto,
    puntajeStakeholders,
    puntajeEntrenamiento,
    puntajePoliticas,
    puntajeMonitoreo,
    puntajeTotal,
    evaluacion,
    factorReduccion,
  };
}
