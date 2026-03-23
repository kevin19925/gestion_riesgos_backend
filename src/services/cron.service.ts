/**
 * SERVICIO DE CRON JOBS
 * Gestiona tareas programadas del sistema
 */

import { generarAlertasVencimiento } from './alertas-vencimiento.service';

/**
 * Intervalo para ejecutar el cron job (en milisegundos)
 * Por defecto: cada 24 horas (86400000 ms)
 */
const INTERVALO_ALERTAS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Hora de ejecución diaria (formato 24h)
 */
const HORA_EJECUCION = 8; // 08:00 AM

let cronJobActivo: NodeJS.Timeout | null = null;
let ultimaEjecucion: Date | null = null;

/**
 * Calcula el tiempo hasta la próxima ejecución programada
 */
function calcularTiempoHastaProximaEjecucion(): number {
  const ahora = new Date();
  const proximaEjecucion = new Date();
  
  proximaEjecucion.setHours(HORA_EJECUCION, 0, 0, 0);
  
  // Si ya pasó la hora de hoy, programar para mañana
  if (ahora.getHours() >= HORA_EJECUCION) {
    proximaEjecucion.setDate(proximaEjecucion.getDate() + 1);
  }
  
  return proximaEjecucion.getTime() - ahora.getTime();
}

/**
 * Ejecuta la tarea de generación de alertas
 */
async function ejecutarTareaAlertas() {
  console.log(`[CRON] Ejecutando generación de alertas: ${new Date().toISOString()}`);
  
  try {
    const resultado = await generarAlertasVencimiento();
    
    console.log(`[CRON] Alertas generadas: ${resultado.generadas}`);
    console.log(`[CRON] Errores: ${resultado.errores}`);
    
    if (resultado.detalles.length > 0) {
      console.log('[CRON] Detalles:');
      resultado.detalles.forEach(detalle => console.log(`  - ${detalle}`));
    }
    
    ultimaEjecucion = new Date();
  } catch (error) {
    console.error('[CRON] Error al ejecutar tarea de alertas:', error);
  }
}

/**
 * Programa la próxima ejecución del cron job
 */
function programarProximaEjecucion() {
  const tiempoHastaProxima = calcularTiempoHastaProximaEjecucion();
  const proximaEjecucion = new Date(Date.now() + tiempoHastaProxima);
  
  console.log(`[CRON] Próxima ejecución programada para: ${proximaEjecucion.toISOString()}`);
  
  cronJobActivo = setTimeout(async () => {
    await ejecutarTareaAlertas();
    programarProximaEjecucion(); // Reprogramar para el siguiente día
  }, tiempoHastaProxima);
}

/**
 * Inicia el servicio de cron jobs
 */
export function iniciarCronJobs() {
  console.log('[CRON] Iniciando servicio de cron jobs...');
  
  // Ejecutar inmediatamente al iniciar (opcional, comentar si no se desea)
  // ejecutarTareaAlertas();
  
  // Programar primera ejecución
  programarProximaEjecucion();
  
  console.log('[CRON] Servicio de cron jobs iniciado correctamente');
}

/**
 * Detiene el servicio de cron jobs
 */
export function detenerCronJobs() {
  if (cronJobActivo) {
    clearTimeout(cronJobActivo);
    cronJobActivo = null;
    console.log('[CRON] Servicio de cron jobs detenido');
  }
}

/**
 * Ejecuta manualmente la tarea de alertas (para testing)
 */
export async function ejecutarManualmente() {
  console.log('[CRON] Ejecución manual solicitada');
  await ejecutarTareaAlertas();
}

/**
 * Obtiene el estado del servicio de cron
 */
export function obtenerEstadoCron() {
  return {
    activo: cronJobActivo !== null,
    ultimaEjecucion,
    proximaEjecucion: cronJobActivo ? new Date(Date.now() + calcularTiempoHastaProximaEjecucion()) : null,
    horaConfigurada: `${HORA_EJECUCION}:00`,
    intervalo: `${INTERVALO_ALERTAS / (1000 * 60 * 60)} horas`
  };
}
