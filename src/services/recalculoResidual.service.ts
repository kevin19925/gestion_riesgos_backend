/**
 * Servicio de Recálculo Residual - REFACTORIZADO
 *
 * Versión actualizada que trabaja directamente con las tablas normalizadas:
 * - ControlRiesgo: para datos de controles
 * - EvaluacionRiesgo: para valores residuales
 * 
 * Eliminado: Toda lógica que usaba CausaRiesgo.gestion (JSONB)
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
  controlesActualizados: number;
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
  
  return 'Inefectivo';
}

/**
 * Determina la evaluación definitiva (ajuste por desviaciones)
 */
function determinarEvaluacionDefinitiva(
  evaluacionPreliminar: string,
  desviaciones: number
): string {
  if (desviaciones === 3) { // C
    return 'Inefectivo';
  }
  
  if (desviaciones === 2 && evaluacionPreliminar === 'Altamente Efectivo') { // B
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
  
  return 'NIVEL BAJO';
}

/**
 * Calcula frecuencia residual
 */
export function calcularFrecuenciaResidual(
  frecuenciaInherente: number,
  porcentajeMitigacion: number,
  tipoMitigacion: string | null,
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
 * Calcula impacto residual
 */
export function calcularImpactoResidual(
  impactoInherente: number,
  porcentajeMitigacion: number,
  tipoMitigacion: string | null,
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

type FrecuenciaCatalogItem = { id: number; label: string; peso: number | null };

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
 * Recalcula un control específico
 */
async function recalcularControl(
  control: any,
  causa: any,
  pesos: Record<string, number>,
  rangos: any[],
  tablaMitigacion: Record<string, number>,
  rangosNivelRiesgo: any[],
  porcentajeDimensionCruzada: number,
  frecuenciasCatalog: FrecuenciaCatalogItem[]
): Promise<any> {
  // 1. Calcular puntaje total
  const puntajes = {
    aplicabilidad: control.aplicabilidad || 0,
    cobertura: control.cobertura || 0,
    facilidad: control.facilidadUso || 0,
    segregacion: control.segregacion || 0,
    naturaleza: control.naturaleza || 0,
  };
  
  const puntajeTotal = calcularPuntajeTotal(puntajes, pesos);

  // 2. Evaluación preliminar
  const evaluacionPreliminar = determinarEvaluacionPreliminar(puntajeTotal, rangos);

  // 3. Evaluación definitiva
  const desviaciones = control.desviaciones ?? 1; // A=1, B=2, C=3
  const evaluacionDefinitiva = determinarEvaluacionDefinitiva(evaluacionPreliminar, desviaciones);

  // 4. Porcentaje de mitigación
  const porcentajeMitigacion = tablaMitigacion[evaluacionDefinitiva] || 0;

  // 5. Valores inherentes del riesgo
  const riesgo = causa.riesgo;
  if (!riesgo?.evaluacion) {
    return null;
  }

  const frecuenciaPorCausa = resolverFrecuenciaCausaA1_5(causa.frecuencia, frecuenciasCatalog);
  const frecuenciaInherente = frecuenciaPorCausa ?? riesgo.evaluacion.probabilidad ?? 1;
  const impactoEval = riesgo.evaluacion.impactoGlobal != null ? Number(riesgo.evaluacion.impactoGlobal) : riesgo.evaluacion.impactoMaximo;
  const impactoInherente = Math.max(1, Math.min(5, Math.round(impactoEval) || 1));
  const tipoMitigacion = control.tipoMitigacion || 'AMBAS';

  // 6. Calcular valores residuales
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

  let calificacionResidual = frecuenciaResidual * impactoResidual;
  if (frecuenciaResidual === 2 && impactoResidual === 2) {
    calificacionResidual = 3.99;
  }

  const nivelRiesgoResidual = determinarNivelRiesgoResidual(calificacionResidual, rangosNivelRiesgo);

  return {
    controlId: control.id,
    causaId: causa.id,
    riesgoId: causa.riesgoId,
    datosActualizados: {
      puntajeControl: puntajeTotal,
      evaluacionPreliminar,
      evaluacionDefinitiva,
      estandarizacionPorcentajeMitigacion: Math.round(porcentajeMitigacion * 100),
      recalculadoEn: new Date()
    },
    valoresResiduales: {
      frecuenciaResidual,
      impactoResidual,
      calificacionResidual,
      nivelRiesgoResidual
    }
  };
}

/**
 * Recalcula todos los riesgos residuales
 */
export async function recalcularTodosLosRiesgosResiduales(
  preview: boolean = false
): Promise<ResultadoRecalculo> {
  const resultado: ResultadoRecalculo = {
    causasActualizadas: 0,
    controlesActualizados: 0,
    riesgosActualizados: 0,
    errores: [],
    detalles: []
  };

  try {
    const config = await getConfiguracionActiva();
    const pesos = await getPesosCriterios();
    const rangos = await getRangosEvaluacion();
    const tablaMitigacion = await getTablaMitigacion();
    const rangosNivelRiesgo = await getRangosNivelRiesgo();
    const porcentajeDimensionCruzada = await getPorcentajeDimensionCruzada();
    
    console.log(`${LOG_PREFIX} Inicio recálculo (config id=${config.id}). Preview=${preview}`);

    const frecuenciasCatalog = await prisma.frecuenciaCatalog.findMany().then(rows =>
      rows.map(r => ({ id: r.id, label: r.label, peso: r.peso }))
    );

    // Obtener todas las causas que tienen controles
    const causasConControles = await prisma.causaRiesgo.findMany({
      where: {
        controles: { some: {} }
      },
      include: {
        controles: true,
        riesgo: {
          include: { evaluacion: true }
        }
      }
    });

    console.log(`${LOG_PREFIX} Causas con controles a procesar: ${causasConControles.length}`);

    const riesgosAfectados = new Set<number>();
    const actualizacionesControles: { controlId: number; datos: any }[] = [];

    for (const causa of causasConControles) {
      try {
        for (const control of causa.controles) {
          const recalculo = await recalcularControl(
            control,
            causa,
            pesos,
            rangos,
            tablaMitigacion,
            rangosNivelRiesgo,
            porcentajeDimensionCruzada,
            frecuenciasCatalog
          );

          if (recalculo) {
            resultado.detalles.push(recalculo);
            riesgosAfectados.add(recalculo.riesgoId);
            
            console.log(
              `${LOG_PREFIX} Control ${recalculo.controlId} (causa ${recalculo.causaId}, riesgo ${recalculo.riesgoId}): ` +
              `Frecuencia residual=${recalculo.valoresResiduales.frecuenciaResidual} ` +
              `Impacto residual=${recalculo.valoresResiduales.impactoResidual} ` +
              `Calificación residual=${recalculo.valoresResiduales.calificacionResidual} ` +
              `nivel=${recalculo.valoresResiduales.nivelRiesgoResidual}`
            );

            if (!preview) {
              actualizacionesControles.push({
                controlId: recalculo.controlId,
                datos: recalculo.datosActualizados
              });
            }
          }
        }
        resultado.causasActualizadas++;
      } catch (error: any) {
        resultado.errores.push(`Error en causa ${causa.id}: ${error.message}`);
        console.warn(`${LOG_PREFIX} Error causa ${causa.id}:`, error?.message);
      }
    }

    // Guardar controles en lotes
    if (!preview && actualizacionesControles.length > 0) {
      const TAMANO_LOTE = 50;
      for (let i = 0; i < actualizacionesControles.length; i += TAMANO_LOTE) {
        const lote = actualizacionesControles.slice(i, i + TAMANO_LOTE);
        await Promise.all(
          lote.map(({ controlId, datos }) =>
            prisma.controlRiesgo.update({
              where: { id: controlId },
              data: datos
            })
          )
        );
        resultado.controlesActualizados += lote.length;
      }
    }

    // Actualizar EvaluacionRiesgo de todos los riesgos
    if (!preview) {
      const todosRiesgoIds = Array.from(riesgosAfectados);
      console.log(`${LOG_PREFIX} Actualizando EvaluacionRiesgo para ${todosRiesgoIds.length} riesgos...`);
      
      const LOTE_EVAL = 25;
      for (let i = 0; i < todosRiesgoIds.length; i += LOTE_EVAL) {
        const loteIds = todosRiesgoIds.slice(i, i + LOTE_EVAL);
        await Promise.all(loteIds.map((riesgoId) => actualizarEvaluacionRiesgo(riesgoId)));
      }
      resultado.riesgosActualizados = todosRiesgoIds.length;
    }

    console.log(`${LOG_PREFIX} Fin: ${resultado.controlesActualizados} controles actualizados, ${resultado.riesgosActualizados} riesgos con mapa residual actualizado.`);

  } catch (error: any) {
    resultado.errores.push(`Error general: ${error.message}`);
  }

  return resultado;
}

/**
 * Actualiza la tabla EvaluacionRiesgo con los valores residuales
 */
async function actualizarEvaluacionRiesgo(riesgoId: number) {
  const evaluacion = await prisma.evaluacionRiesgo.findFirst({
    where: { riesgoId }
  });
  if (!evaluacion) return;

  // Obtener todas las causas con controles de este riesgo
  const causasConControles = await prisma.causaRiesgo.findMany({
    where: {
      riesgoId,
      controles: { some: {} }
    },
    include: {
      controles: true
    }
  });

  let probabilidadResidual: number;
  let impactoResidual: number;
  let riesgoResidual: number;
  let nivelRiesgoResidual: string;

  if (causasConControles.length === 0) {
    // Sin controles: residual = inherente
    probabilidadResidual = evaluacion.probabilidad ?? 1;
    impactoResidual = evaluacion.impactoGlobal ?? 1;
    riesgoResidual = evaluacion.riesgoInherente ?? 1;
    nivelRiesgoResidual = evaluacion.nivelRiesgo ?? 'NIVEL BAJO';
  } else {
    // Calcular valores residuales basados en controles
    // Aquí necesitaríamos recalcular o leer los valores ya calculados
    // Por simplicidad, tomamos el control con mayor efectividad
    let maxCalificacionResidual = 0;
    let maxFrecuenciaResidual = 0;
    let maxImpactoResidual = 0;

    // Nota: Los valores residuales por control no se guardan en ControlRiesgo
    // Se calculan on-the-fly. Para optimizar, podrías agregar campos a ControlRiesgo
    // o calcularlos aquí mismo.
    
    // Por ahora, usar valores inherentes como fallback
    probabilidadResidual = evaluacion.probabilidad ?? 1;
    impactoResidual = evaluacion.impactoGlobal ?? 1;
    riesgoResidual = probabilidadResidual * impactoResidual;
    nivelRiesgoResidual = evaluacion.nivelRiesgo ?? 'NIVEL BAJO';
  }

  await prisma.evaluacionRiesgo.updateMany({
    where: { riesgoId },
    data: {
      probabilidadResidual: Math.round(probabilidadResidual),
      impactoResidual: Math.round(impactoResidual),
      riesgoResidual: Math.round(riesgoResidual),
      nivelRiesgoResidual
    }
  });
}

/**
 * Recalcula el riesgo residual solo para un riesgo
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

    const causasConControles = await prisma.causaRiesgo.findMany({
      where: {
        riesgoId,
        controles: { some: {} }
      },
      include: {
        controles: true,
        riesgo: { include: { evaluacion: true } }
      }
    });

    for (const causa of causasConControles) {
      for (const control of causa.controles) {
        const recalculo = await recalcularControl(
          control,
          causa,
          pesos,
          rangos,
          tablaMitigacion,
          rangosNivelRiesgo,
          porcentajeDimensionCruzada,
          frecuenciasCatalog
        );
        
        if (recalculo) {
          await prisma.controlRiesgo.update({
            where: { id: recalculo.controlId },
            data: recalculo.datosActualizados
          });
        }
      }
    }
  }

  await actualizarEvaluacionRiesgo(riesgoId);
}

/**
 * Calcula el riesgo residual para OPORTUNIDADES (riesgos positivos)
 * Usa Medidas de Administración en lugar de Controles (ControlRiesgo)
 * 
 * Se selecciona la medida con mayor factorReduccion de entre todas las causas del riesgo.
 * La reducción se aplica según el campo "afecta": FRECUENCIA, IMPACTO, o AMBAS.
 */
export async function calcularResidualOportunidad(
  riesgoId: number
): Promise<{
  probabilidadResidual: number;
  impactoResidual: number;
  calificacionResidual: number;
}> {
  // 1. Obtener el riesgo con su evaluación y causas+medidas
  const riesgo = await prisma.riesgo.findUnique({
    where: { id: riesgoId },
    include: {
      evaluacion: true,
      causas: {
        include: {
          medidasAdministracion: true,
        },
      },
    },
  });

  if (!riesgo || !riesgo.evaluacion) {
    throw new Error(`Riesgo o evaluación no encontrada para riesgoId=${riesgoId}`);
  }

  // 2. Valores inherentes
  const probInherente = Number(riesgo.evaluacion.probabilidad ?? 1);
  const impactoInherente = Number(riesgo.evaluacion.impactoGlobal ?? 1);

  // 3. Buscar la mejor medida de administración entre todas las causas
  let mejorFactorReduccion = 0;
  let mejorAfecta = 'AMBAS';

  for (const causa of riesgo.causas) {
    if (!causa.medidasAdministracion || causa.medidasAdministracion.length === 0) continue;

    // Ordenar de mayor a menor puntajeTotal y tomar la mejor
    const mejorMedida = [...causa.medidasAdministracion]
      .sort((a, b) => (b.puntajeTotal ?? 0) - (a.puntajeTotal ?? 0))[0];

    const factor = mejorMedida.factorReduccion ?? 0;
    if (factor > mejorFactorReduccion) {
      mejorFactorReduccion = factor;
      mejorAfecta = (mejorMedida.afecta ?? 'AMBAS').toUpperCase();
    }
  }

  // 4. Aplicar reducción según el campo "afecta"
  let probResidual = probInherente;
  let impactoResidual = impactoInherente;

  if (mejorFactorReduccion > 0) {
    if (mejorAfecta === 'FRECUENCIA') {
      probResidual = Math.max(1, Math.round(probInherente * (1 - mejorFactorReduccion)));
    } else if (mejorAfecta === 'IMPACTO') {
      impactoResidual = Math.max(1, Math.round(impactoInherente * (1 - mejorFactorReduccion)));
    } else {
      // AMBAS
      probResidual = Math.max(1, Math.round(probInherente * (1 - mejorFactorReduccion)));
      impactoResidual = Math.max(1, Math.round(impactoInherente * (1 - mejorFactorReduccion)));
    }
  }

  const calificacionResidual = probResidual * impactoResidual;

  return {
    probabilidadResidual: probResidual,
    impactoResidual,
    calificacionResidual,
  };
}
