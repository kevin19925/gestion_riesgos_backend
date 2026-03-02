/**
 * Servicio de Recálculo Residual
 *
 * Alineado con la plantilla Excel "Herramienta de gestión de riesgos Planificación Financiera Pame.xlsm":
 * - BY = Frecuencia residual (1..5), BZ = Impacto residual (1..5), por causa.
 * - CA = Calificación de la causa residual: si BY=2 y BZ=2 → 3.99; si no → BY×BZ.
 * - CB = Por riesgo: causa con mayor CA; el mapa usa la BY y BZ de esa causa (probabilidadResidual, impactoResidual en EvaluacionRiesgo).
 *
 * Fórmulas de ajuste (columnas W/AD en Excel):
 * - Si control aplica a FRECUENCIA o AMBAS: reducir valor por porcentaje de mitigación (tabla admin).
 * - Si control aplica a IMPACTO y evaluación Efectivo/Altamente Efectivo: reducción fija 34% sobre frecuencia.
 * - Si control aplica a FRECUENCIA y evaluación Efectivo/Altamente Efectivo: reducción fija 34% sobre impacto.
 * Redondeo: REDONDEAR.MAS(..., 0) → Math.ceil. Resultado acotado 1..5.
 *
 * Recalcula usando la configuración activa (pesos, rangos evaluación, tabla mitigación, rangos nivel).
 * Actualiza CausaRiesgo.gestion y EvaluacionRiesgo para el mapa residual.
 */

import prisma from '../prisma';

const LOG_PREFIX = '[RecalcResidual]';
import {
  getConfiguracionActiva,
  getPesosCriterios,
  getRangosEvaluacion,
  getTablaMitigacion,
  getRangosNivelRiesgo,
  getPorcentajeDimensionCruzada
} from './configuracionResidual.service';

interface ResultadoRecalculo {
  causasActualizadas: number;
  riesgosActualizados: number;
  errores: string[];
  detalles: any[];
}

/**
 * Calcula el puntaje total del control usando pesos configurables
 */
function calcularPuntajeTotal(
  puntajes: Record<string, number>,
  pesos: Record<string, number>
): number {
  return (
    (puntajes.aplicabilidad || 0) * (pesos.aplicabilidad || 0) +
    (puntajes.cobertura || 0) * (pesos.cobertura || 0) +
    (puntajes.facilidad || 0) * (pesos.facilidad || 0) +
    (puntajes.segregacion || 0) * (pesos.segregacion || 0) +
    (puntajes.naturaleza || 0) * (pesos.naturaleza || 0)
  );
}

/**
 * Determina la evaluación preliminar según rangos configurables
 */
function determinarEvaluacionPreliminar(
  puntajeTotal: number,
  rangos: any[]
): string {
  for (const rango of rangos) {
    const cumpleMinimo = rango.incluirMinimo 
      ? puntajeTotal >= rango.valorMinimo 
      : puntajeTotal > rango.valorMinimo;
    
    const cumpleMaximo = rango.incluirMaximo 
      ? puntajeTotal <= rango.valorMaximo 
      : puntajeTotal < rango.valorMaximo;
    
    if (cumpleMinimo && cumpleMaximo) {
      return rango.nivelNombre;
    }
  }
  
  return 'Inefectivo'; // Fallback
}

/**
 * Determina la evaluación definitiva (ajuste por desviaciones)
 */
function determinarEvaluacionDefinitiva(
  evaluacionPreliminar: string,
  desviaciones: string
): string {
  if (desviaciones === 'C') {
    return 'Inefectivo';
  }
  
  if (desviaciones === 'B' && evaluacionPreliminar === 'Altamente Efectivo') {
    return 'Efectivo';
  }
  
  return evaluacionPreliminar;
}

/**
 * Determina el nivel de riesgo residual según rangos configurables
 */
function determinarNivelRiesgoResidual(
  calificacionResidual: number,
  rangos: any[]
): string {
  for (const rango of rangos) {
    const cumpleMinimo = rango.incluirMinimo 
      ? calificacionResidual >= rango.valorMinimo 
      : calificacionResidual > rango.valorMinimo;
    
    const cumpleMaximo = rango.incluirMaximo 
      ? calificacionResidual <= rango.valorMaximo 
      : calificacionResidual < rango.valorMaximo;
    
    if (cumpleMinimo && cumpleMaximo) {
      return rango.nivelNombre;
    }
  }
  
  return 'NIVEL BAJO'; // Fallback
}

/**
 * Calcula frecuencia residual (BY).
 * Si control aplica a FRECUENCIA o AMBAS: reduce por porcentajeMitigacion (tabla admin).
 * Si control aplica a IMPACTO y evaluación Efectivo/Altamente Efectivo: reduce por porcentajeDimensionCruzada (admin).
 */
export function calcularFrecuenciaResidual(
  frecuenciaInherente: number,
  porcentajeMitigacion: number,
  tipoMitigacion: string,
  evaluacionDefinitiva: string,
  porcentajeDimensionCruzada: number
): number {
  if (tipoMitigacion === 'FRECUENCIA' || tipoMitigacion === 'AMBAS') {
    const residual = frecuenciaInherente - (frecuenciaInherente * porcentajeMitigacion);
    return Math.max(1, Math.min(5, Math.ceil(residual)));
  }
  if (tipoMitigacion === 'IMPACTO' && (evaluacionDefinitiva === 'Efectivo' || evaluacionDefinitiva === 'Altamente Efectivo')) {
    const residual = frecuenciaInherente - (frecuenciaInherente * porcentajeDimensionCruzada);
    return Math.max(1, Math.min(5, Math.ceil(residual)));
  }
  return Math.max(1, Math.min(5, frecuenciaInherente));
}

/**
 * Calcula impacto residual (BZ).
 * Si control aplica a IMPACTO o AMBAS: reduce por porcentajeMitigacion (tabla admin).
 * Si control aplica a FRECUENCIA y evaluación Efectivo/Altamente Efectivo: reduce por porcentajeDimensionCruzada (admin).
 */
export function calcularImpactoResidual(
  impactoInherente: number,
  porcentajeMitigacion: number,
  tipoMitigacion: string,
  evaluacionDefinitiva: string,
  porcentajeDimensionCruzada: number
): number {
  if (tipoMitigacion === 'IMPACTO' || tipoMitigacion === 'AMBAS') {
    const residual = impactoInherente - (impactoInherente * porcentajeMitigacion);
    return Math.max(1, Math.min(5, Math.ceil(residual)));
  }
  if (tipoMitigacion === 'FRECUENCIA' && (evaluacionDefinitiva === 'Efectivo' || evaluacionDefinitiva === 'Altamente Efectivo')) {
    const residual = impactoInherente - (impactoInherente * porcentajeDimensionCruzada);
    return Math.max(1, Math.min(5, Math.ceil(residual)));
  }
  return Math.max(1, Math.min(5, impactoInherente));
}

/** Catálogo de frecuencias para resolver causa.frecuencia a escala 1-5 */
type FrecuenciaCatalogItem = { id: number; label: string; peso: number | null };

/**
 * Resuelve la frecuencia de la causa (catálogo) a un valor 1-5 para usar como frecuencia inherente (BY).
 * Misma lógica que recalcularRiesgoInherenteDesdeCausas.
 */
function resolverFrecuenciaCausaA1_5(
  causaFrecuencia: string | null | undefined,
  frecuenciasCatalog: FrecuenciaCatalogItem[]
): number | null {
  if (causaFrecuencia == null || String(causaFrecuencia).trim() === '') return null;
  const s = String(causaFrecuencia).trim();
  if (/^\d+$/.test(s)) {
    const freqId = parseInt(s, 10);
    const f = frecuenciasCatalog.find(fc => fc.id === freqId);
    const p = f?.peso ?? f?.id ?? freqId;
    return Math.max(1, Math.min(5, Math.round(Number(p))));
  }
  const f = frecuenciasCatalog.find(fc => fc.label?.toLowerCase() === s.toLowerCase());
  const p = f?.peso ?? f?.id ?? 3;
  return Math.max(1, Math.min(5, Math.round(Number(p))));
}

/**
 * Recalcula una causa específica
 */
async function recalcularCausa(
  causa: any,
  pesos: Record<string, number>,
  rangos: any[],
  tablaMitigacion: Record<string, number>,
  rangosNivelRiesgo: any[],
  porcentajeDimensionCruzada: number = 0.34,
  frecuenciasCatalog: FrecuenciaCatalogItem[] = []
): Promise<any> {
  const gestion = causa.gestion || {};

  // 1. Recalcular puntaje total
  const puntajes = {
    aplicabilidad: gestion.puntajeAplicabilidad || 0,
    cobertura: gestion.puntajeCobertura || 0,
    facilidad: gestion.puntajeFacilidad || 0,
    segregacion: gestion.puntajeSegregacion || 0,
    naturaleza: gestion.puntajeNaturaleza || 0,
  };
  
  const puntajeTotal = calcularPuntajeTotal(puntajes, pesos);

  // 2. Recalcular evaluación preliminar
  const evaluacionPreliminar = determinarEvaluacionPreliminar(puntajeTotal, rangos);

  // 3. Recalcular evaluación definitiva (desviaciones puede venir como desviaciones o controlDesviaciones desde el front)
  const desviaciones = gestion.desviaciones ?? gestion.controlDesviaciones ?? 'A';
  const evaluacionDefinitiva = determinarEvaluacionDefinitiva(evaluacionPreliminar, desviaciones);

  // 4. Obtener porcentaje de mitigación
  const porcentajeMitigacion = tablaMitigacion[evaluacionDefinitiva] || 0;

  // 5. Valores inherentes del riesgo (usar causa.riesgo si ya viene incluido, sino 1 query)
  let riesgo = causa.riesgo;
  if (!riesgo?.evaluacion) {
    riesgo = await prisma.riesgo.findUnique({
      where: { id: causa.riesgoId },
      include: { evaluacion: true }
    });
  }
  if (!riesgo || !riesgo.evaluacion) {
    return null;
  }

  // Frecuencia inherente: por causa desde catálogo (igual que en inherente). Si la causa no tiene frecuencia, usar probabilidad del riesgo.
  const frecuenciaPorCausa = resolverFrecuenciaCausaA1_5(causa.frecuencia, frecuenciasCatalog);
  const frecuenciaInherente = frecuenciaPorCausa ?? riesgo.evaluacion.probabilidad ?? 1;
  // Usar impactoGlobal (1-5) como impacto inherente: es el que actualiza recalcularRiesgoInherenteDesdeCausas.
  // impactoMaximo a menudo no se actualiza y puede quedar en 1, lo que hacía que todo el impacto residual saliera 1.
  const impactoEval = riesgo.evaluacion.impactoGlobal != null ? Number(riesgo.evaluacion.impactoGlobal) : riesgo.evaluacion.impactoMaximo;
  const impactoInherente = Math.max(1, Math.min(5, Math.round(impactoEval) || 1));
  const tipoMitigacion = gestion.tipoMitigacion || 'AMBAS';

  // 6. Calcular valores residuales (BY, BZ); dimensión cruzada usa porcentaje desde admin
  const frecuenciaResidual = calcularFrecuenciaResidual(
    frecuenciaInherente,
    porcentajeMitigacion,
    tipoMitigacion,
    evaluacionDefinitiva,
    porcentajeDimensionCruzada
  );

  const impactoResidual = calcularImpactoResidual(
    impactoInherente,
    porcentajeMitigacion,
    tipoMitigacion,
    evaluacionDefinitiva,
    porcentajeDimensionCruzada
  );

  // Calificación residual: excepción 2×2 = 3.99 (según matriz de riesgos)
  let calificacionResidual = frecuenciaResidual * impactoResidual;
  if (frecuenciaResidual === 2 && impactoResidual === 2) {
    calificacionResidual = 3.99;
  }

  // 7. Determinar nivel de riesgo residual usando rangos configurables (admin)
  const nivelRiesgoResidual = determinarNivelRiesgoResidual(calificacionResidual, rangosNivelRiesgo);

  // 8. Actualizar objeto gestion
  const gestionActualizada = {
    ...gestion,
    puntajeTotal,
    evaluacionPreliminar,
    evaluacionDefinitiva,
    porcentajeMitigacion,
    frecuenciaResidual,
    impactoResidual,
    calificacionResidual,
    nivelRiesgoResidual,
    recalculadoEn: new Date().toISOString()
  };

  return {
    causaId: causa.id,
    riesgoId: causa.riesgoId,
    gestionActualizada,
    cambios: {
      puntajeTotal: { anterior: gestion.puntajeTotal, nuevo: puntajeTotal },
      evaluacionDefinitiva: { anterior: gestion.evaluacionDefinitiva, nuevo: evaluacionDefinitiva },
      porcentajeMitigacion: { anterior: gestion.porcentajeMitigacion, nuevo: porcentajeMitigacion },
      calificacionResidual: { anterior: gestion.calificacionResidual, nuevo: calificacionResidual }
    }
  };
}

/**
 * Recálculo en base de datos: invoca el procedimiento almacenado recalcular_residuales_completo().
 * Libera el proceso Node (todo el trabajo lo hace la BD).
 * Requiere que la migración 20250224120000_recalcular_residual_en_bd esté aplicada.
 */
export async function recalcularResidualesEnBD(): Promise<{ causasActualizadas: number; riesgosActualizados: number }> {
  console.log(`${LOG_PREFIX} Ejecutando recálculo en BD (procedimiento recalcular_residuales_completo)...`);
  const rows = await prisma.$queryRawUnsafe<Array<{ causas_actualizadas: bigint; riesgos_actualizados: bigint }>>(
    'SELECT * FROM recalcular_residuales_completo()'
  );
  const row = rows?.[0];
  const causas = row ? Number(row.causas_actualizadas) : 0;
  const riesgos = row ? Number(row.riesgos_actualizados) : 0;
  console.log(`${LOG_PREFIX} BD listo: ${causas} causas actualizadas, ${riesgos} riesgos actualizados (mapa residual usa probabilidadResidual/impactoResidual de EvaluacionRiesgo).`);
  return { causasActualizadas: causas, riesgosActualizados: riesgos };
}

/**
 * Recalcula todos los riesgos residuales
 * 
 * @param preview - Si es true, solo simula sin guardar cambios
 */
export async function recalcularTodosLosRiesgosResiduales(
  preview: boolean = false
): Promise<ResultadoRecalculo> {
  const resultado: ResultadoRecalculo = {
    causasActualizadas: 0,
    riesgosActualizados: 0,
    errores: [],
    detalles: []
  };

  try {
    // 1. Obtener configuración activa
    const config = await getConfiguracionActiva();
    const pesos = await getPesosCriterios();
    const rangos = await getRangosEvaluacion();
    const tablaMitigacion = await getTablaMitigacion();
    const rangosNivelRiesgo = await getRangosNivelRiesgo();
    console.log(`${LOG_PREFIX} Inicio recálculo (config id=${config.id}). Preview=${preview}`);

    // 2. Parámetros de config (todo desde admin)
    const porcentajeDimensionCruzada = await getPorcentajeDimensionCruzada();

    // Catálogo de frecuencias para usar la frecuencia de cada causa en BY (calificación residual de la frecuencia)
    const frecuenciasCatalog = await prisma.frecuenciaCatalog.findMany().then(rows =>
      rows.map(r => ({ id: r.id, label: r.label, peso: r.peso }))
    );

    // 3. Obtener todas las causas con controles
    const causas = await prisma.causaRiesgo.findMany({
      where: {
        tipoGestion: { in: ['CONTROL', 'AMBOS'] },
        gestion: { not: null }
      },
      include: {
        riesgo: {
          include: { evaluacion: true }
        }
      }
    });
    console.log(`${LOG_PREFIX} Causas con CONTROL/AMBOS a procesar: ${causas.length}`);

    // 3. Recalcular cada causa (solo fórmulas en memoria; causa.riesgo ya viene incluido, sin queries extra)
    const riesgosAfectados = new Set<number>();
    const actualizaciones: { causaId: number; gestion: any }[] = [];

    for (const causa of causas) {
      try {
        const recalculo = await recalcularCausa(causa, pesos, rangos, tablaMitigacion, rangosNivelRiesgo, porcentajeDimensionCruzada, frecuenciasCatalog);
        if (recalculo) {
          resultado.detalles.push(recalculo);
          riesgosAfectados.add(recalculo.riesgoId);
          const g = recalculo.gestionActualizada;
          const camb = recalculo.cambios;
          const cambió = camb && (
            camb.puntajeTotal?.anterior !== camb.puntajeTotal?.nuevo ||
            camb.calificacionResidual?.anterior !== camb.calificacionResidual?.nuevo
          );
          console.log(
            `${LOG_PREFIX} Causa ${recalculo.causaId} (riesgo ${recalculo.riesgoId}): Frecuencia residual=${g.frecuenciaResidual} Impacto residual=${g.impactoResidual} Calificación de la causa residual=${g.calificacionResidual} nivel=${g.nivelRiesgoResidual}` +
            (cambió ? ` | cambió: Calificación de la causa residual ${camb?.calificacionResidual?.anterior}→${camb?.calificacionResidual?.nuevo}` : '')
          );
          if (!preview) {
            actualizaciones.push({ causaId: recalculo.causaId, gestion: recalculo.gestionActualizada });
          }
        }
      } catch (error: any) {
        resultado.errores.push(`Error en causa ${causa.id}: ${error.message}`);
        console.warn(`${LOG_PREFIX} Error causa ${causa.id}:`, error?.message);
      }
    }

    // 4. Guardar causas en lotes (mucho más rápido que 247 updates secuenciales)
    if (!preview && actualizaciones.length > 0) {
      const TAMANO_LOTE = 50;
      for (let i = 0; i < actualizaciones.length; i += TAMANO_LOTE) {
        const lote = actualizaciones.slice(i, i + TAMANO_LOTE);
        await Promise.all(
          lote.map(({ causaId, gestion }) =>
            prisma.causaRiesgo.update({
              where: { id: causaId },
              data: { gestion }
            })
          )
        );
        resultado.causasActualizadas += lote.length;
      }
    }

    resultado.riesgosActualizados = riesgosAfectados.size;

    // 5. Actualizar EvaluacionRiesgo de TODOS los riesgos (mapa residual completo)
    if (!preview) {
      const todasEval = await prisma.evaluacionRiesgo.findMany({ select: { riesgoId: true } });
      const todosRiesgoIds = [...new Set(todasEval.map((e) => e.riesgoId))];
      console.log(`${LOG_PREFIX} Actualizando EvaluacionRiesgo (mapa residual completo) para ${todosRiesgoIds.length} riesgos...`);
      const LOTE_EVAL = 25;
      for (let i = 0; i < todosRiesgoIds.length; i += LOTE_EVAL) {
        const loteIds = todosRiesgoIds.slice(i, i + LOTE_EVAL);
        await Promise.all(loteIds.map((riesgoId) => actualizarEvaluacionRiesgo(riesgoId, i < LOTE_EVAL)));
      }
      resultado.riesgosActualizados = todosRiesgoIds.length;
    }

    console.log(`${LOG_PREFIX} Fin: ${resultado.causasActualizadas} causas actualizadas, ${resultado.riesgosActualizados} riesgos con mapa residual actualizado.`);

  } catch (error: any) {
    resultado.errores.push(`Error general: ${error.message}`);
  }

  return resultado;
}

/**
 * Actualiza la tabla EvaluacionRiesgo con los valores residuales.
 * Solo cuentan causas con CONTROL o AMBOS; las que solo tienen PLAN no cambian la calificación residual.
 * Estos campos son los que usa el mapa de riesgos residual (posición por probabilidadResidual, impactoResidual).
 * @param logReubicacion - si true, escribe en consola el antes/después para ver la reubicación en el mapa
 */
async function actualizarEvaluacionRiesgo(riesgoId: number, logReubicacion: boolean = false) {
  const evaluacion = await prisma.evaluacionRiesgo.findFirst({
    where: { riesgoId }
  });
  if (!evaluacion) return;

  const anteriores = {
    prob: evaluacion.probabilidadResidual ?? null,
    impacto: evaluacion.impactoResidual ?? null,
    nivel: evaluacion.nivelRiesgoResidual ?? null
  };

  const causas = await prisma.causaRiesgo.findMany({
    where: {
      riesgoId,
      tipoGestion: { in: ['CONTROL', 'AMBOS'] },
      gestion: { not: null }
    }
  });

  let probabilidadResidual: number;
  let impactoResidual: number;
  let riesgoResidual: number;
  let nivelRiesgoResidual: string;

  if (causas.length === 0) {
    // Sin controles: residual = inherente (el mapa residual mostrará la misma posición que el inherente)
    probabilidadResidual = evaluacion.probabilidad != null ? evaluacion.probabilidad : 1;
    impactoResidual = evaluacion.impactoGlobal != null ? evaluacion.impactoGlobal : 1;
    riesgoResidual = evaluacion.riesgoInherente != null ? evaluacion.riesgoInherente : 1;
    nivelRiesgoResidual = evaluacion.nivelRiesgo != null ? evaluacion.nivelRiesgo : 'NIVEL BAJO';
  } else {
    let maxCalificacionResidual = 0;
    let maxFrecuenciaResidual = 0;
    let maxImpactoResidual = 0;
    let nivelRiesgoResidualMax = 'NIVEL BAJO';

    for (const causa of causas) {
      const gestion = causa.gestion as any;
      if (gestion && gestion.calificacionResidual != null) {
        if (gestion.calificacionResidual > maxCalificacionResidual) {
          maxCalificacionResidual = gestion.calificacionResidual;
          maxFrecuenciaResidual = gestion.frecuenciaResidual != null ? gestion.frecuenciaResidual : 0;
          maxImpactoResidual = gestion.impactoResidual != null ? gestion.impactoResidual : 0;
          nivelRiesgoResidualMax = gestion.nivelRiesgoResidual != null ? gestion.nivelRiesgoResidual : 'NIVEL BAJO';
        }
      }
    }

    probabilidadResidual = maxFrecuenciaResidual || (evaluacion.probabilidad != null ? evaluacion.probabilidad : 1);
    impactoResidual = maxImpactoResidual || (evaluacion.impactoGlobal != null ? evaluacion.impactoGlobal : 1);
    riesgoResidual = maxCalificacionResidual || (evaluacion.riesgoInherente != null ? evaluacion.riesgoInherente : 1);
    nivelRiesgoResidual = nivelRiesgoResidualMax;
  }

  const nuevosProb = Math.round(probabilidadResidual);
  const nuevosImpacto = Math.round(impactoResidual);

  await prisma.evaluacionRiesgo.updateMany({
    where: { riesgoId },
    data: {
      probabilidadResidual: nuevosProb,
      impactoResidual: nuevosImpacto,
      riesgoResidual: Math.round(riesgoResidual),
      nivelRiesgoResidual
    }
  });

  if (logReubicacion && (anteriores.prob !== nuevosProb || anteriores.impacto !== nuevosImpacto || anteriores.nivel !== nivelRiesgoResidual)) {
    console.log(
      `${LOG_PREFIX} Calificación del riesgo residual (mapa): riesgo ${riesgoId} (probabilidadResidual,impactoResidual,nivelRiesgoResidual) ${anteriores.prob ?? '-'},${anteriores.impacto ?? '-'},${anteriores.nivel ?? '-'} → ${nuevosProb},${nuevosImpacto},${nivelRiesgoResidual}`
    );
  }
}

/**
 * Recalcula el riesgo residual solo para un riesgo (solo causas con CONTROL o AMBOS; PLAN no afecta).
 * Usa la configuración activa del admin (pesos, rangos, tabla mitigación, rangos nivel).
 * Se debe llamar al guardar, editar o eliminar un control de una causa de este riesgo.
 * Siempre actualiza EvaluacionRiesgo: si no queda ninguna causa con control, residual = inherente.
 */
export async function recalcularResidualPorRiesgo(riesgoId: number): Promise<void> {
  const config = await getConfiguracionActiva().catch(() => null);

  if (config) {
    const pesos = await getPesosCriterios();
    const rangos = await getRangosEvaluacion();
    const tablaMitigacion = await getTablaMitigacion();
    const rangosNivelRiesgo = await getRangosNivelRiesgo();
    const porcentajeDimensionCruzada = await getPorcentajeDimensionCruzada();
    const frecuenciasCatalog = await prisma.frecuenciaCatalog.findMany().then(rows =>
      rows.map(r => ({ id: r.id, label: r.label, peso: r.peso }))
    );

    const causas = await prisma.causaRiesgo.findMany({
      where: {
        riesgoId,
        tipoGestion: { in: ['CONTROL', 'AMBOS'] },
        gestion: { not: null }
      },
      include: {
        riesgo: { include: { evaluacion: true } }
      }
    });

    for (const causa of causas) {
      const recalculo = await recalcularCausa(causa, pesos, rangos, tablaMitigacion, rangosNivelRiesgo, porcentajeDimensionCruzada, frecuenciasCatalog);
      if (recalculo) {
        await prisma.causaRiesgo.update({
          where: { id: recalculo.causaId },
          data: { gestion: recalculo.gestionActualizada }
        });
      }
    }
  }

  // Siempre actualizar evaluación: si no hay causas con control, residual = inherente
  await actualizarEvaluacionRiesgo(riesgoId);
}
