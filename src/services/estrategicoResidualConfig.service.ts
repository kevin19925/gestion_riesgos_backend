/**
 * Persistencia de parametrización del motor residual estratégico (tabla Configuracion).
 */

import prisma from '../prisma';
import { mergeStrategicEngineConfig, type StrategicEngineConfig } from './estrategicoResidual.engine';

export const RESIDUAL_ESTRATEGICO_CONFIG_CLAVE = 'residual_estrategico_engine_json';

export async function getStrategicEngineConfigResolved(): Promise<StrategicEngineConfig> {
  const row = await prisma.configuracion.findUnique({
    where: { clave: RESIDUAL_ESTRATEGICO_CONFIG_CLAVE },
  });
  if (!row?.valor?.trim()) return mergeStrategicEngineConfig(null);
  try {
    const parsed = JSON.parse(row.valor) as unknown;
    return mergeStrategicEngineConfig(parsed);
  } catch {
    return mergeStrategicEngineConfig(null);
  }
}

export async function persistStrategicEngineConfig(body: unknown): Promise<StrategicEngineConfig> {
  const merged = mergeStrategicEngineConfig(body);
  await prisma.configuracion.upsert({
    where: { clave: RESIDUAL_ESTRATEGICO_CONFIG_CLAVE },
    create: {
      clave: RESIDUAL_ESTRATEGICO_CONFIG_CLAVE,
      valor: JSON.stringify(merged),
      tipo: 'json',
      descripcion: 'Motor residual estratégico (MA, AZ, BA, factores)',
    },
    update: {
      valor: JSON.stringify(merged),
      tipo: 'json',
      descripcion: 'Motor residual estratégico (MA, AZ, BA, factores)',
    },
  });
  return merged;
}

/** Respuesta GET: incluye defaults explícitos para el formulario admin. */
export function getDefaultStrategicEngineConfigForApi(): StrategicEngineConfig {
  return mergeStrategicEngineConfig(null);
}
