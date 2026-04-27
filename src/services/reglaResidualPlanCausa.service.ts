import prisma from '../prisma';

/** Clave en `Configuracion`: regla “plan en causa sin control → residual = inherente”. */
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

const DESCRIPCION_REGLA =
  'Si está activa: solo cuando una causa tiene plan de acción y aún no tiene control vinculado, el residual del riesgo se iguala al inherente y no se usa la mitigación por controles para ese residual. Si todas las causas con plan ya tienen control, aplica el cálculo habitual por controles. Si está desactivada, siempre el comportamiento por controles.';

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
      descripcion: DESCRIPCION_REGLA,
    },
    update: {
      valor: payload,
      tipo: 'json',
      descripcion: DESCRIPCION_REGLA,
    },
  });
  return { activa: Boolean(activa) };
}

/** Riesgos que tienen al menos un `PlanAccion` con `causaRiesgoId` (cualquier causa con plan). */
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

/**
 * Riesgos donde aplica forzar residual = inherente con la regla activa:
 * existe al menos un plan ligado a una causa **sin** registros en `ControlRiesgo` para esa causa.
 */
export async function listarRiesgoIdsConCausaPlanSinControl(): Promise<Set<number>> {
  if (!(await getReglaResidualIgualInherenteSiPlanCausa())) return new Set();
  const rows = await prisma.planAccion.findMany({
    where: {
      causaRiesgo: {
        controles: { none: {} },
      },
    },
    select: { causaRiesgo: { select: { riesgoId: true } } },
  });
  const ids = new Set<number>();
  for (const r of rows) {
    const rid = r.causaRiesgo?.riesgoId;
    if (rid != null) ids.add(rid);
  }
  return ids;
}

export async function riesgoTieneCausaConPlanSinControl(riesgoId: number): Promise<boolean> {
  const n = await prisma.planAccion.count({
    where: {
      causaRiesgo: {
        riesgoId,
        controles: { none: {} },
      },
    },
  });
  return n > 0;
}

export async function debeForzarResidualIgualInherentePorPlanesCausa(
  riesgoId: number
): Promise<boolean> {
  if (!(await getReglaResidualIgualInherenteSiPlanCausa())) return false;
  return riesgoTieneCausaConPlanSinControl(riesgoId);
}
