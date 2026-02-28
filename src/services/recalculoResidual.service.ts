/**
 * Servicio de Recálculo Residual
 * 
 * Recalcula todos los valores residuales usando la configuración activa
 */

import prisma from '../prisma';
import {
  getConfiguracionActiva,
  getPesosCriterios,
  getRangosEvaluacion,
  getTablaMitigacion,
  getRangosNivelRiesgo
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
 * Calcula frecuencia residual
 */
function calcularFrecuenciaResidual(
  frecuenciaInherente: number,
  porcentajeMitigacion: number,
  tipoMitigacion: string
): number {
  if (tipoMitigacion === 'FRECUENCIA' || tipoMitigacion === 'AMBAS') {
    const residual = frecuenciaInherente - (frecuenciaInherente * porcentajeMitigacion);
    return Math.max(1, Math.ceil(residual));
  }
  return frecuenciaInherente;
}

/**
 * Calcula impacto residual
 */
function calcularImpactoResidual(
  impactoInherente: number,
  porcentajeMitigacion: number,
  tipoMitigacion: string
): number {
  if (tipoMitigacion === 'IMPACTO' || tipoMitigacion === 'AMBAS') {
    const residual = impactoInherente - (impactoInherente * porcentajeMitigacion);
    return Math.max(1, Math.ceil(residual));
  }
  return impactoInherente;
}

/**
 * Recalcula una causa específica
 */
async function recalcularCausa(
  causa: any,
  pesos: Record<string, number>,
  rangos: any[],
  tablaMitigacion: Record<string, number>,
  rangosNivelRiesgo: any[]
): Promise<any> {
  const gestion = causa.gestion || {};
  
  // Si no tiene datos de gestión, saltar
  if (!gestion.puntajeAplicabilidad && !gestion.aplicabilidad) {
    return null;
  }

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

  // 3. Recalcular evaluación definitiva
  const desviaciones = gestion.desviaciones || 'A';
  const evaluacionDefinitiva = determinarEvaluacionDefinitiva(evaluacionPreliminar, desviaciones);

  // 4. Obtener porcentaje de mitigación
  const porcentajeMitigacion = tablaMitigacion[evaluacionDefinitiva] || 0;

  // 5. Obtener valores inherentes del riesgo
  const riesgo = await prisma.riesgo.findUnique({
    where: { id: causa.riesgoId },
    include: { evaluacion: true }
  });

  if (!riesgo || !riesgo.evaluacion) {
    return null;
  }

  const frecuenciaInherente = riesgo.evaluacion.probabilidad || 1;
  const impactoInherente = riesgo.evaluacion.impactoMaximo || 1;
  const tipoMitigacion = gestion.tipoMitigacion || 'AMBAS';

  // 6. Calcular valores residuales
  const frecuenciaResidual = calcularFrecuenciaResidual(
    frecuenciaInherente,
    porcentajeMitigacion,
    tipoMitigacion
  );

  const impactoResidual = calcularImpactoResidual(
    impactoInherente,
    porcentajeMitigacion,
    tipoMitigacion
  );

  const calificacionResidual = frecuenciaResidual * impactoResidual;

  // 7. Determinar nivel de riesgo residual usando rangos configurables
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

    // 2. Obtener todas las causas con controles
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

    // 3. Recalcular cada causa
    const riesgosAfectados = new Set<number>();

    for (const causa of causas) {
      try {
        const recalculo = await recalcularCausa(causa, pesos, rangos, tablaMitigacion, rangosNivelRiesgo);
        
        if (recalculo) {
          resultado.detalles.push(recalculo);
          riesgosAfectados.add(recalculo.riesgoId);

          // Si no es preview, guardar cambios
          if (!preview) {
            await prisma.causaRiesgo.update({
              where: { id: recalculo.causaId },
              data: { gestion: recalculo.gestionActualizada }
            });
            resultado.causasActualizadas++;
          }
        }
      } catch (error: any) {
        resultado.errores.push(`Error en causa ${causa.id}: ${error.message}`);
      }
    }

    resultado.riesgosActualizados = riesgosAfectados.size;

    // 4. Actualizar tabla EvaluacionRiesgo (si no es preview)
    if (!preview) {
      for (const riesgoId of riesgosAfectados) {
        try {
          await actualizarEvaluacionRiesgo(riesgoId);
        } catch (error: any) {
          resultado.errores.push(`Error actualizando evaluación de riesgo ${riesgoId}: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    resultado.errores.push(`Error general: ${error.message}`);
  }

  return resultado;
}

/**
 * Actualiza la tabla EvaluacionRiesgo con los valores residuales
 */
async function actualizarEvaluacionRiesgo(riesgoId: number) {
  // Obtener todas las causas del riesgo con controles
  const causas = await prisma.causaRiesgo.findMany({
    where: {
      riesgoId,
      tipoGestion: { in: ['CONTROL', 'AMBOS'] },
      gestion: { not: null }
    }
  });

  if (causas.length === 0) {
    return;
  }

  // Obtener el máximo valor residual de todas las causas
  let maxCalificacionResidual = 0;
  let maxFrecuenciaResidual = 0;
  let maxImpactoResidual = 0;
  let nivelRiesgoResidual = 'NIVEL BAJO';

  for (const causa of causas) {
    const gestion = causa.gestion as any;
    if (gestion && gestion.calificacionResidual) {
      if (gestion.calificacionResidual > maxCalificacionResidual) {
        maxCalificacionResidual = gestion.calificacionResidual;
        maxFrecuenciaResidual = gestion.frecuenciaResidual || 0;
        maxImpactoResidual = gestion.impactoResidual || 0;
        nivelRiesgoResidual = gestion.nivelRiesgoResidual || 'NIVEL BAJO';
      }
    }
  }

  // Actualizar EvaluacionRiesgo
  await prisma.evaluacionRiesgo.updateMany({
    where: { riesgoId },
    data: {
      probabilidadResidual: maxFrecuenciaResidual,
      impactoResidual: maxImpactoResidual,
      riesgoResidual: maxCalificacionResidual,
      nivelRiesgoResidual
    }
  });
}
