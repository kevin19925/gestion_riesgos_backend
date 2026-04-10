import prisma from '../prisma';

/** Clave en tabla Configuracion. true en JSON = el usuario puede editar el campo. */
export const UI_CAMPOS_HABILITACION_CLAVE = 'ui_habilitacion_campos';

export const UI_CAMPO_PLAN_FECHA_ESTIMADA_FINALIZACION =
  'plan_accion_fecha_estimada_finalizacion';
export const UI_CAMPO_PLAN_FECHA_FINALIZACION =
  'plan_accion_fecha_finalizacion';

export function defaultUiCamposHabilitacion(): Record<string, boolean> {
  return {
    [UI_CAMPO_PLAN_FECHA_ESTIMADA_FINALIZACION]: true,
    [UI_CAMPO_PLAN_FECHA_FINALIZACION]: true,
  };
}

export async function getUiCamposHabilitacionFlags(): Promise<
  Record<string, boolean>
> {
  const base = defaultUiCamposHabilitacion();
  const row = await prisma.configuracion.findUnique({
    where: { clave: UI_CAMPOS_HABILITACION_CLAVE },
  });
  if (!row?.valor) return base;
  try {
    const parsed = JSON.parse(row.valor) as Record<string, boolean>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}
