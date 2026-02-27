/**
 * SCRIPT DE PRUEBA LOCAL - Configuración Residual
 * 
 * Este script prueba todo el sistema de configuración residual
 * SIN tocar la base de datos de producción.
 * 
 * Uso: npx ts-node test-configuracion-residual.ts
 */

// NO necesitamos PrismaClient para esta prueba
// Solo simulamos los cálculos

// Datos de prueba simulados
const DATOS_PRUEBA = {
  causa: {
    id: 1,
    riesgoId: 1,
    descripcion: 'Causa de prueba',
    tipoGestion: 'CONTROL',
    gestion: {
      // Puntajes de criterios
      aplicabilidad: 'Cuenta con procedimientos documentados y se ejecuta',
      puntajeAplicabilidad: 100,
      cobertura: 'Periodicidad definida y se ejecuta',
      puntajeCobertura: 70,
      facilidadUso: 'Sencillo de ejecutar',
      puntajeFacilidad: 20,
      segregacion: 'No',
      puntajeSegregacion: 0,
      naturaleza: 'Mixto',
      puntajeNaturaleza: 15,
      
      // Desviaciones
      desviaciones: 'B', // Se han encontrado desviaciones
      
      // Tipo de mitigación
      tipoMitigacion: 'AMBAS',
      
      // Valores actuales (antes del recálculo)
      puntajeTotal: 62,
      evaluacionPreliminar: 'Medianamente Efectivo',
      evaluacionDefinitiva: 'Medianamente Efectivo',
      porcentajeMitigacion: 0.33,
      frecuenciaResidual: 3,
      impactoResidual: 1,
      calificacionResidual: 3,
      nivelRiesgoResidual: 'NIVEL BAJO'
    }
  },
  riesgo: {
    id: 1,
    evaluacion: {
      probabilidad: 3, // Frecuencia inherente
      impactoMaximo: 1, // Impacto inherente
      riesgoInherente: 3
    }
  }
};

// Configuración actual (hardcodeada)
const CONFIG_ACTUAL = {
  pesos: {
    aplicabilidad: 0.25,
    cobertura: 0.25,
    facilidad: 0.10,
    segregacion: 0.20,
    naturaleza: 0.20,
  },
  rangos: [
    { nivelNombre: 'Inefectivo', valorMinimo: 0, valorMaximo: 24.99 },
    { nivelNombre: 'Baja Efectividad', valorMinimo: 25, valorMaximo: 45.99 },
    { nivelNombre: 'Medianamente Efectivo', valorMinimo: 46, valorMaximo: 64.99 },
    { nivelNombre: 'Efectivo', valorMinimo: 65, valorMaximo: 84.99 },
    { nivelNombre: 'Altamente Efectivo', valorMinimo: 85, valorMaximo: 100 },
  ],
  tablaMitigacion: {
    'Altamente Efectivo': 0.81,
    'Efectivo': 0.61,
    'Medianamente Efectivo': 0.33,
    'Baja Efectividad': 0.20,
    'Inefectivo': 0.0,
  },
  rangosNivelRiesgo: [
    { nivelNombre: 'NIVEL BAJO', valorMinimo: 1, valorMaximo: 4 },
    { nivelNombre: 'NIVEL MEDIO', valorMinimo: 5, valorMaximo: 9 },
    { nivelNombre: 'NIVEL ALTO', valorMinimo: 10, valorMaximo: 14 },
    { nivelNombre: 'NIVEL CRÍTICO', valorMinimo: 15, valorMaximo: 25 },
  ]
};

// Nueva configuración (modificada para prueba)
const CONFIG_NUEVA = {
  pesos: {
    aplicabilidad: 0.30, // Cambio: de 25% a 30%
    cobertura: 0.25,
    facilidad: 0.10,
    segregacion: 0.15, // Cambio: de 20% a 15%
    naturaleza: 0.20,
  },
  rangos: [
    { nivelNombre: 'Inefectivo', valorMinimo: 0, valorMaximo: 29.99 }, // Cambio
    { nivelNombre: 'Baja Efectividad', valorMinimo: 30, valorMaximo: 49.99 }, // Cambio
    { nivelNombre: 'Medianamente Efectivo', valorMinimo: 50, valorMaximo: 69.99 }, // Cambio
    { nivelNombre: 'Efectivo', valorMinimo: 70, valorMaximo: 89.99 }, // Cambio
    { nivelNombre: 'Altamente Efectivo', valorMinimo: 90, valorMaximo: 100 }, // Cambio
  ],
  tablaMitigacion: {
    'Altamente Efectivo': 0.85, // Cambio: de 81% a 85%
    'Efectivo': 0.65, // Cambio: de 61% a 65%
    'Medianamente Efectivo': 0.40, // Cambio: de 33% a 40%
    'Baja Efectividad': 0.25, // Cambio: de 20% a 25%
    'Inefectivo': 0.0,
  },
  rangosNivelRiesgo: [
    { nivelNombre: 'NIVEL BAJO', valorMinimo: 1, valorMaximo: 5 }, // Cambio: de 4 a 5
    { nivelNombre: 'NIVEL MEDIO', valorMinimo: 6, valorMaximo: 10 }, // Cambio
    { nivelNombre: 'NIVEL ALTO', valorMinimo: 11, valorMaximo: 15 }, // Cambio
    { nivelNombre: 'NIVEL CRÍTICO', valorMinimo: 16, valorMaximo: 25 }, // Cambio
  ]
};

// Funciones de cálculo
function calcularPuntajeTotal(puntajes: any, pesos: any): number {
  return (
    puntajes.aplicabilidad * pesos.aplicabilidad +
    puntajes.cobertura * pesos.cobertura +
    puntajes.facilidad * pesos.facilidad +
    puntajes.segregacion * pesos.segregacion +
    puntajes.naturaleza * pesos.naturaleza
  );
}

function determinarEvaluacionPreliminar(puntajeTotal: number, rangos: any[]): string {
  for (const rango of rangos) {
    if (puntajeTotal >= rango.valorMinimo && puntajeTotal <= rango.valorMaximo) {
      return rango.nivelNombre;
    }
  }
  return 'Inefectivo';
}

function determinarEvaluacionDefinitiva(preliminar: string, desviaciones: string): string {
  if (desviaciones === 'C') return 'Inefectivo';
  if (desviaciones === 'B' && preliminar === 'Altamente Efectivo') return 'Efectivo';
  return preliminar;
}

function calcularFrecuenciaResidual(inherente: number, mitigacion: number, tipo: string): number {
  if (tipo === 'FRECUENCIA' || tipo === 'AMBAS') {
    const residual = inherente - (inherente * mitigacion);
    return Math.max(1, Math.ceil(residual));
  }
  return inherente;
}

function calcularImpactoResidual(inherente: number, mitigacion: number, tipo: string): number {
  if (tipo === 'IMPACTO' || tipo === 'AMBAS') {
    const residual = inherente - (inherente * mitigacion);
    return Math.max(1, Math.ceil(residual));
  }
  return inherente;
}

function determinarNivelRiesgoResidual(calificacion: number, rangos: any[]): string {
  for (const rango of rangos) {
    if (calificacion >= rango.valorMinimo && calificacion <= rango.valorMaximo) {
      return rango.nivelNombre;
    }
  }
  return 'NIVEL BAJO';
}

// Función principal de prueba
async function probarRecalculo() {
  console.log('🧪 INICIANDO PRUEBA DE RECÁLCULO RESIDUAL\n');
  console.log('=' .repeat(80));
  
  const gestion = DATOS_PRUEBA.causa.gestion;
  const evaluacion = DATOS_PRUEBA.riesgo.evaluacion;
  
  // ESCENARIO 1: Con configuración actual
  console.log('\n📊 ESCENARIO 1: Configuración Actual (Hardcodeada)');
  console.log('-'.repeat(80));
  
  const puntajes1 = {
    aplicabilidad: gestion.puntajeAplicabilidad,
    cobertura: gestion.puntajeCobertura,
    facilidad: gestion.puntajeFacilidad,
    segregacion: gestion.puntajeSegregacion,
    naturaleza: gestion.puntajeNaturaleza,
  };
  
  const puntajeTotal1 = calcularPuntajeTotal(puntajes1, CONFIG_ACTUAL.pesos);
  const evaluacionPreliminar1 = determinarEvaluacionPreliminar(puntajeTotal1, CONFIG_ACTUAL.rangos);
  const evaluacionDefinitiva1 = determinarEvaluacionDefinitiva(evaluacionPreliminar1, gestion.desviaciones);
  const porcentajeMitigacion1 = CONFIG_ACTUAL.tablaMitigacion[evaluacionDefinitiva1] || 0;
  const frecuenciaResidual1 = calcularFrecuenciaResidual(evaluacion.probabilidad, porcentajeMitigacion1, gestion.tipoMitigacion);
  const impactoResidual1 = calcularImpactoResidual(evaluacion.impactoMaximo, porcentajeMitigacion1, gestion.tipoMitigacion);
  const calificacionResidual1 = frecuenciaResidual1 * impactoResidual1;
  const nivelRiesgoResidual1 = determinarNivelRiesgoResidual(calificacionResidual1, CONFIG_ACTUAL.rangosNivelRiesgo);
  
  console.log('Puntajes de criterios:');
  console.log(`  Aplicabilidad: ${puntajes1.aplicabilidad} × ${CONFIG_ACTUAL.pesos.aplicabilidad} = ${puntajes1.aplicabilidad * CONFIG_ACTUAL.pesos.aplicabilidad}`);
  console.log(`  Cobertura: ${puntajes1.cobertura} × ${CONFIG_ACTUAL.pesos.cobertura} = ${puntajes1.cobertura * CONFIG_ACTUAL.pesos.cobertura}`);
  console.log(`  Facilidad: ${puntajes1.facilidad} × ${CONFIG_ACTUAL.pesos.facilidad} = ${puntajes1.facilidad * CONFIG_ACTUAL.pesos.facilidad}`);
  console.log(`  Segregación: ${puntajes1.segregacion} × ${CONFIG_ACTUAL.pesos.segregacion} = ${puntajes1.segregacion * CONFIG_ACTUAL.pesos.segregacion}`);
  console.log(`  Naturaleza: ${puntajes1.naturaleza} × ${CONFIG_ACTUAL.pesos.naturaleza} = ${puntajes1.naturaleza * CONFIG_ACTUAL.pesos.naturaleza}`);
  console.log(`\nPuntaje Total: ${puntajeTotal1.toFixed(2)}`);
  console.log(`Evaluación Preliminar: ${evaluacionPreliminar1}`);
  console.log(`Evaluación Definitiva: ${evaluacionDefinitiva1}`);
  console.log(`Porcentaje Mitigación: ${(porcentajeMitigacion1 * 100).toFixed(0)}%`);
  console.log(`\nFrecuencia Inherente: ${evaluacion.probabilidad}`);
  console.log(`Impacto Inherente: ${evaluacion.impactoMaximo}`);
  console.log(`Frecuencia Residual: ${frecuenciaResidual1}`);
  console.log(`Impacto Residual: ${impactoResidual1}`);
  console.log(`Calificación Residual: ${calificacionResidual1}`);
  console.log(`Nivel de Riesgo Residual: ${nivelRiesgoResidual1}`);
  
  // ESCENARIO 2: Con nueva configuración
  console.log('\n\n📊 ESCENARIO 2: Nueva Configuración (Modificada)');
  console.log('-'.repeat(80));
  
  const puntajeTotal2 = calcularPuntajeTotal(puntajes1, CONFIG_NUEVA.pesos);
  const evaluacionPreliminar2 = determinarEvaluacionPreliminar(puntajeTotal2, CONFIG_NUEVA.rangos);
  const evaluacionDefinitiva2 = determinarEvaluacionDefinitiva(evaluacionPreliminar2, gestion.desviaciones);
  const porcentajeMitigacion2 = CONFIG_NUEVA.tablaMitigacion[evaluacionDefinitiva2] || 0;
  const frecuenciaResidual2 = calcularFrecuenciaResidual(evaluacion.probabilidad, porcentajeMitigacion2, gestion.tipoMitigacion);
  const impactoResidual2 = calcularImpactoResidual(evaluacion.impactoMaximo, porcentajeMitigacion2, gestion.tipoMitigacion);
  const calificacionResidual2 = frecuenciaResidual2 * impactoResidual2;
  const nivelRiesgoResidual2 = determinarNivelRiesgoResidual(calificacionResidual2, CONFIG_NUEVA.rangosNivelRiesgo);
  
  console.log('Puntajes de criterios (con nuevos pesos):');
  console.log(`  Aplicabilidad: ${puntajes1.aplicabilidad} × ${CONFIG_NUEVA.pesos.aplicabilidad} = ${puntajes1.aplicabilidad * CONFIG_NUEVA.pesos.aplicabilidad}`);
  console.log(`  Cobertura: ${puntajes1.cobertura} × ${CONFIG_NUEVA.pesos.cobertura} = ${puntajes1.cobertura * CONFIG_NUEVA.pesos.cobertura}`);
  console.log(`  Facilidad: ${puntajes1.facilidad} × ${CONFIG_NUEVA.pesos.facilidad} = ${puntajes1.facilidad * CONFIG_NUEVA.pesos.facilidad}`);
  console.log(`  Segregación: ${puntajes1.segregacion} × ${CONFIG_NUEVA.pesos.segregacion} = ${puntajes1.segregacion * CONFIG_NUEVA.pesos.segregacion}`);
  console.log(`  Naturaleza: ${puntajes1.naturaleza} × ${CONFIG_NUEVA.pesos.naturaleza} = ${puntajes1.naturaleza * CONFIG_NUEVA.pesos.naturaleza}`);
  console.log(`\nPuntaje Total: ${puntajeTotal2.toFixed(2)}`);
  console.log(`Evaluación Preliminar: ${evaluacionPreliminar2}`);
  console.log(`Evaluación Definitiva: ${evaluacionDefinitiva2}`);
  console.log(`Porcentaje Mitigación: ${(porcentajeMitigacion2 * 100).toFixed(0)}%`);
  console.log(`\nFrecuencia Inherente: ${evaluacion.probabilidad}`);
  console.log(`Impacto Inherente: ${evaluacion.impactoMaximo}`);
  console.log(`Frecuencia Residual: ${frecuenciaResidual2}`);
  console.log(`Impacto Residual: ${impactoResidual2}`);
  console.log(`Calificación Residual: ${calificacionResidual2}`);
  console.log(`Nivel de Riesgo Residual: ${nivelRiesgoResidual2}`);
  
  // COMPARACIÓN
  console.log('\n\n📈 COMPARACIÓN DE RESULTADOS');
  console.log('='.repeat(80));
  console.log(`${'Campo'.padEnd(30)} | ${'Actual'.padEnd(20)} | ${'Nueva'.padEnd(20)} | Cambio`);
  console.log('-'.repeat(80));
  console.log(`${'Puntaje Total'.padEnd(30)} | ${puntajeTotal1.toFixed(2).padEnd(20)} | ${puntajeTotal2.toFixed(2).padEnd(20)} | ${(puntajeTotal2 - puntajeTotal1 > 0 ? '+' : '')}${(puntajeTotal2 - puntajeTotal1).toFixed(2)}`);
  console.log(`${'Evaluación Definitiva'.padEnd(30)} | ${evaluacionDefinitiva1.padEnd(20)} | ${evaluacionDefinitiva2.padEnd(20)} | ${evaluacionDefinitiva1 === evaluacionDefinitiva2 ? '=' : '≠'}`);
  console.log(`${'% Mitigación'.padEnd(30)} | ${(porcentajeMitigacion1 * 100).toFixed(0) + '%'.padEnd(20)} | ${(porcentajeMitigacion2 * 100).toFixed(0) + '%'.padEnd(20)} | ${(porcentajeMitigacion2 - porcentajeMitigacion1 > 0 ? '+' : '')}${((porcentajeMitigacion2 - porcentajeMitigacion1) * 100).toFixed(0)}%`);
  console.log(`${'Calificación Residual'.padEnd(30)} | ${calificacionResidual1.toString().padEnd(20)} | ${calificacionResidual2.toString().padEnd(20)} | ${(calificacionResidual2 - calificacionResidual1 > 0 ? '+' : '')}${calificacionResidual2 - calificacionResidual1}`);
  console.log(`${'Nivel Riesgo Residual'.padEnd(30)} | ${nivelRiesgoResidual1.padEnd(20)} | ${nivelRiesgoResidual2.padEnd(20)} | ${nivelRiesgoResidual1 === nivelRiesgoResidual2 ? '=' : '≠'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ PRUEBA COMPLETADA\n');
  console.log('💡 Conclusión:');
  console.log('   - Los cambios en la configuración SÍ afectan los resultados');
  console.log('   - El recálculo automático es necesario para mantener consistencia');
  console.log('   - Este script NO modificó ninguna base de datos\n');
}

// Ejecutar prueba
probarRecalculo()
  .then(() => {
    console.log('🎉 Script de prueba finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en script de prueba:', error);
    process.exit(1);
  });
