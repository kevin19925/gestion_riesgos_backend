import prisma from '../prisma';

/** Clave en `Configuracion`: si está activa y el riesgo tiene al menos un plan ligado a una causa, residual = inherente y no se recalculan controles para residual. */
export const REGLA_RESIDUAL_PLAN_CAUSA_CLAVE = 'regla_residual_igual_inherente_si_plan_causa';

export async function getReglaResidualIgualInherenteSiPlanCausa(): Promise<boolean> {
  const row = await prisma.configuracion.findUnique({
    where: { clave: REGLA_RESIDUAL_PLAN_CAUSA_CLAVE },
  });
  if (!row?.valor) return false;
  try {
    const parsed = JSON.parse(row.valor) as { activa?: boolean };
    return Boolean(parsed?.activa);
  } catch {
    return false;
  }
}

export async function setReglaResidualIgualInherenteSiPlanCausa(
  activa: boolean
): Promise<{ activa: boolean }> {
  const payload = JSON.stringify({ activa: Boolean(activa) });
  await prisma.configuracion.upsert({
    where: { clave: REGLA_RESIDUAL_PLAN_CAUSA_CLAVE },
    create: {
      clave: REGLA_RESIDUAL_PLAN_CAUSA_CLAVE,
      valor: payload,
      tipo: 'json',
      descripcion:
        'Si está activa: con al menos un plan de acción en alguna causa del riesgo, la calificación residual se iguala a la inherente y no se aplica mitigación por controles.',
    },
    update: {
      valor: payload,
      tipo: 'json',
      descripcion:
        'Si está activa: con al menos un plan de acción en alguna causa del riesgo, la calificación residual se iguala a la inherente y no se aplica mitigación por controles.',
    },
  });
  return { activa: Boolean(activa) };
}

/** Riesgos que tienen al menos un `PlanAccion` con `causaRiesgoId` (plan asociado a una causa). */
export async function listarRiesgoIdsConPlanEnCausa(): Promise<Set<number>> {
  const rows = await prisma.planAccion.findMany({
    where: { causaRiesgoId: { not: null } },
    select: { causaRiesgo: { select: { riesgoId: true } } },
  });
  const ids = new Set<number>();
  for (const r of rows) {
    const rid = r.causaRiesgo?.riesgoId;
    if (rid != null) ids.add(rid);
  }
  return ids;
}

export async function riesgoTienePlanAccionEnAlgunaCausa(riesgoId: number): Promise<boolean> {
  const n = await prisma.planAccion.count({
    where: { causaRiesgo: { riesgoId } },
  });
  return n > 0;
}

export async function debeForzarResidualIgualInherentePorPlanesCausa(
  riesgoId: number
): Promise<boolean> {
  if (!(await getReglaResidualIgualInherenteSiPlanCausa())) return false;
  return riesgoTienePlanAccionEnAlgunaCausa(riesgoId);
}
