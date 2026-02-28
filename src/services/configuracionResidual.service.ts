/**
 * Servicio de Configuración Residual
 * 
 * Maneja la obtención y caché de la configuración activa
 */

import prisma from '../prisma';

// Caché en memoria de la configuración
let configCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la configuración residual activa
 * Usa caché para evitar consultas repetidas
 */
export async function getConfiguracionActiva() {
  const now = Date.now();
  
  // Si hay caché válido, retornarlo
  if (configCache && (now - cacheTimestamp) < CACHE_TTL) {
    return configCache;
  }

  // Obtener de BD
  const config = await prisma.configuracionResidual.findFirst({
    where: { activa: true },
    include: {
      pesosCriterios: {
        where: { activo: true },
        orderBy: { orden: 'asc' }
      },
      rangosEvaluacion: {
        where: { activo: true },
        orderBy: { orden: 'asc' }
      },
      tablaMitigacion: {
        where: { activo: true },
        orderBy: { orden: 'asc' }
      },
      rangosNivelRiesgo: {
        where: { activo: true },
        orderBy: { orden: 'asc' }
      },
      opcionesCriterios: {
        where: { activo: true },
        orderBy: [{ criterio: 'asc' }, { orden: 'asc' }]
      }
    }
  });

  if (!config) {
    throw new Error('No hay configuración residual activa');
  }

  // Actualizar caché
  configCache = config;
  cacheTimestamp = now;

  return config;
}

/**
 * Invalida el caché de configuración
 * Llamar después de actualizar la configuración
 */
export function invalidarCacheConfiguracion() {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Obtiene los pesos de criterios como objeto
 */
export async function getPesosCriterios(): Promise<Record<string, number>> {
  const config = await getConfiguracionActiva();
  const pesos: Record<string, number> = {};
  
  config.pesosCriterios.forEach((peso: any) => {
    pesos[peso.criterio] = peso.peso;
  });
  
  return pesos;
}

/**
 * Obtiene los rangos de evaluación como array
 */
export async function getRangosEvaluacion() {
  const config = await getConfiguracionActiva();
  return config.rangosEvaluacion;
}

/**
 * Obtiene la tabla de mitigación como objeto
 */
export async function getTablaMitigacion(): Promise<Record<string, number>> {
  const config = await getConfiguracionActiva();
  const tabla: Record<string, number> = {};
  
  config.tablaMitigacion.forEach((item: any) => {
    tabla[item.evaluacion] = item.porcentaje;
  });
  
  return tabla;
}

/**
 * Obtiene las opciones de un criterio específico
 */
export async function getOpcionesCriterio(criterio: string) {
  const config = await getConfiguracionActiva();
  return config.opcionesCriterios.filter((op: any) => op.criterio === criterio);
}

/**
 * Obtiene los rangos de nivel de riesgo residual
 */
export async function getRangosNivelRiesgo() {
  const config = await getConfiguracionActiva();
  return config.rangosNivelRiesgo;
}
