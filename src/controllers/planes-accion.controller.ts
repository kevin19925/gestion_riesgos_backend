import { Request, Response } from "express";
import prisma from "../prisma";
import {
  getUiCamposHabilitacionFlags,
  UI_CAMPO_PLAN_FECHA_ESTIMADA_FINALIZACION,
  UI_CAMPO_PLAN_FECHA_FINALIZACION,
} from "../services/uiCamposHabilitacion.service";
import { recalcularResidualPorRiesgo } from "../services/recalculoResidual.service";

type PlanEnlacesRecalculo = {
  causaRiesgoId?: number | null;
  riesgoId?: number | null;
  incidenciaId?: number | null;
};

async function resolverRiesgoIdParaRecalculoResidual(
  plan: PlanEnlacesRecalculo
): Promise<number | null> {
  if (plan.causaRiesgoId != null) {
    const c = await prisma.causaRiesgo.findUnique({
      where: { id: plan.causaRiesgoId },
      select: { riesgoId: true },
    });
    return c?.riesgoId ?? null;
  }
  if (plan.riesgoId != null) return Number(plan.riesgoId);
  if (plan.incidenciaId != null) {
    const i = await prisma.incidencia.findUnique({
      where: { id: plan.incidenciaId },
      select: { riesgoId: true },
    });
    return i?.riesgoId != null ? Number(i.riesgoId) : null;
  }
  return null;
}

async function dispararRecalculoResidualPorPlanes(
  prev: PlanEnlacesRecalculo | null,
  next: PlanEnlacesRecalculo
): Promise<void> {
  const ids = new Set<number>();
  if (prev) {
    const a = await resolverRiesgoIdParaRecalculoResidual(prev);
    if (a != null) ids.add(a);
  }
  const b = await resolverRiesgoIdParaRecalculoResidual(next);
  if (b != null) ids.add(b);
  for (const id of ids) {
    try {
      await recalcularResidualPorRiesgo(id);
    } catch {
      /* no bloquear guardado del plan */
    }
  }
}

function ymd(input: unknown): string | null {
  if (input == null || input === "") return null;
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  const s = String(input);
  if (s.includes("T")) return s.split("T")[0].slice(0, 10);
  return s.slice(0, 10);
}

function strNorm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

const FIELD_LOCKED = {
  error:
    "Este dato no puede modificarse: está deshabilitado por el administrador del sistema.",
  code: "FIELD_LOCKED",
} as const;

/**
 * PLANES DE ACCIÓN CONTROLLER
 * Gestiona planes de acción (preventivos y reactivos)
 */

export const getPlanes = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [planes, total] = await Promise.all([
      prisma.planAccion.findMany({
        skip,
        take: pageSize,
        include: {
          riesgo: { select: { id: true, procesoId: true, proceso: { select: { id: true, nombre: true, sigla: true } } } },
          incidencia: { select: { id: true, procesoId: true, proceso: { select: { id: true, nombre: true, sigla: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.planAccion.count(),
    ]);

    const planesConProceso = planes.map((plan: any) => ({
      ...plan,
      procesoNombre:
        plan.riesgo?.proceso?.nombre ||
        plan.incidencia?.proceso?.nombre ||
        null,
      procesoId: plan.riesgo?.procesoId || plan.incidencia?.procesoId || null,
    }));

    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    res.json({
      data: planesConProceso,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching planes" });
  }
};

export const getPlanesByRiesgo = async (req: Request, res: Response) => {
  try {
    const riesgoId = Number(req.params.riesgoId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where = { riesgoId, incidenciaId: null };

    const [planes, total] = await Promise.all([
      prisma.planAccion.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.planAccion.count({ where }),
    ]);

    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    res.json({
      data: planes,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching planes" });
  }
};

export const getPlanesByIncidencia = async (req: Request, res: Response) => {
  try {
    const incidenciaId = Number(req.params.incidenciaId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where = { incidenciaId, riesgoId: null };

    const [planes, total] = await Promise.all([
      prisma.planAccion.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.planAccion.count({ where }),
    ]);

    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    res.json({
      data: planes,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching planes reactivos" });
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);

    const plan = await prisma.planAccion.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Error fetching plan" });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    // Extraer riesgoId/incidenciaId desde URL params (si existen) o desde body
    const riesgoIdFromParams = req.params.riesgoId ? Number(req.params.riesgoId) : null;
    const incidenciaIdFromParams = req.params.incidenciaId ? Number(req.params.incidenciaId) : null;
    
    const {
      riesgoId: riesgoIdFromBody,
      incidenciaId: incidenciaIdFromBody,
      causaRiesgoId,
      nombre,
      objetivo,
      descripcion,
      responsable,
      fechaInicio,
      fechaFin,
      fechaProgramada,
      fechaFinalizacion,
      seguimientoDetalle,
      seguimientoEvidenciaUrl1,
      seguimientoEvidenciaUrl2,
      estado = "Planeado",
      prioridad = 3,
      presupuesto,
      porcentajeAvance,
      observaciones,
    } = req.body;

    // Priorizar params sobre body
    const riesgoId = riesgoIdFromParams || riesgoIdFromBody;
    const incidenciaId = incidenciaIdFromParams || incidenciaIdFromBody;

    if (!descripcion) {
      return res.status(400).json({ error: "descripcion is required" });
    }

    if (!riesgoId && !incidenciaId) {
      return res.status(400).json({
        error: "Se requiere riesgoId (preventivo) o incidenciaId (reactivo)",
      });
    }

    const flags = await getUiCamposHabilitacionFlags();
    const hasFechaEst =
      Boolean(fechaFin && String(fechaFin).trim()) ||
      Boolean(fechaProgramada && String(fechaProgramada).trim());
    if (!flags[UI_CAMPO_PLAN_FECHA_ESTIMADA_FINALIZACION] && hasFechaEst) {
      return res.status(403).json(FIELD_LOCKED);
    }
    const hasCierre =
      Boolean(fechaFinalizacion && String(fechaFinalizacion).trim()) ||
      Boolean(strNorm(seguimientoDetalle)) ||
      Boolean(strNorm(seguimientoEvidenciaUrl1)) ||
      Boolean(strNorm(seguimientoEvidenciaUrl2));
    if (!flags[UI_CAMPO_PLAN_FECHA_FINALIZACION] && hasCierre) {
      return res.status(403).json(FIELD_LOCKED);
    }

    const plan = await prisma.planAccion.create({
      data: {
        ...(riesgoId && { riesgoId: Number(riesgoId) }),
        ...(incidenciaId && { incidenciaId: Number(incidenciaId) }),
        ...(causaRiesgoId != null && { causaRiesgoId: Number(causaRiesgoId) }),
        nombre,
        objetivo,
        descripcion,
        responsable: responsable || "",
        fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
        fechaFin: fechaFin ? new Date(fechaFin) : undefined,
        fechaProgramada: fechaProgramada
          ? new Date(fechaProgramada)
          : undefined,
        ...(fechaFinalizacion
          ? { fechaFinalizacion: new Date(fechaFinalizacion) }
          : {}),
        ...(seguimientoDetalle !== undefined && { seguimientoDetalle }),
        ...(seguimientoEvidenciaUrl1 !== undefined && { seguimientoEvidenciaUrl1 }),
        ...(seguimientoEvidenciaUrl2 !== undefined && { seguimientoEvidenciaUrl2 }),
        estado,
        prioridad: Number(prioridad),
        ...(presupuesto !== undefined && { presupuesto: Number(presupuesto) }),
        ...(porcentajeAvance !== undefined && {
          porcentajeAvance: Number(porcentajeAvance),
        }),
        observaciones,
      },
    });

    await dispararRecalculoResidualPorPlanes(null, plan);

    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: "Error creating plan" });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);
    const {
      descripcion,
      responsable,
      nombre,
      objetivo,
      riesgoId,
      incidenciaId,
      causaRiesgoId,
      fechaInicio,
      fechaFin,
      fechaProgramada,
      fechaEjecucion,
      fechaFinalizacion,
      seguimientoDetalle,
      seguimientoEvidenciaUrl1,
      seguimientoEvidenciaUrl2,
      estado,
      prioridad,
      presupuesto,
      porcentajeAvance,
      observaciones,
    } = req.body;

    const existing = await prisma.planAccion.findUnique({
      where: { id: planId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const flags = await getUiCamposHabilitacionFlags();

    if (!flags[UI_CAMPO_PLAN_FECHA_ESTIMADA_FINALIZACION]) {
      if (
        fechaFin !== undefined &&
        ymd(fechaFin) !== ymd(existing.fechaFin)
      ) {
        return res.status(403).json(FIELD_LOCKED);
      }
      if (
        fechaProgramada !== undefined &&
        ymd(fechaProgramada) !== ymd(existing.fechaProgramada)
      ) {
        return res.status(403).json(FIELD_LOCKED);
      }
    }

    if (!flags[UI_CAMPO_PLAN_FECHA_FINALIZACION]) {
      if (
        fechaFinalizacion !== undefined &&
        ymd(fechaFinalizacion) !== ymd(existing.fechaFinalizacion)
      ) {
        return res.status(403).json(FIELD_LOCKED);
      }
      if (
        seguimientoDetalle !== undefined &&
        strNorm(seguimientoDetalle) !== strNorm(existing.seguimientoDetalle)
      ) {
        return res.status(403).json(FIELD_LOCKED);
      }
      if (
        seguimientoEvidenciaUrl1 !== undefined &&
        strNorm(seguimientoEvidenciaUrl1) !==
          strNorm(existing.seguimientoEvidenciaUrl1)
      ) {
        return res.status(403).json(FIELD_LOCKED);
      }
      if (
        seguimientoEvidenciaUrl2 !== undefined &&
        strNorm(seguimientoEvidenciaUrl2) !==
          strNorm(existing.seguimientoEvidenciaUrl2)
      ) {
        return res.status(403).json(FIELD_LOCKED);
      }
    }

    const plan = await prisma.planAccion.update({
      where: { id: planId },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(objetivo !== undefined && { objetivo }),
        // Permitir guardar cadena vacía (p. ej. usuario borró el texto); antes `descripcion &&` omitía el campo y no se persistía.
        ...(descripcion !== undefined && { descripcion }),
        ...(responsable !== undefined && { responsable }),
        ...(riesgoId !== undefined && { riesgoId: riesgoId != null ? Number(riesgoId) : null }),
        ...(incidenciaId !== undefined && { incidenciaId: incidenciaId != null ? Number(incidenciaId) : null }),
        ...(causaRiesgoId !== undefined && { causaRiesgoId: causaRiesgoId != null ? Number(causaRiesgoId) : null }),
        ...(fechaInicio !== undefined && {
          fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        }),
        ...(fechaFin !== undefined && {
          fechaFin: fechaFin ? new Date(fechaFin) : null,
        }),
        ...(fechaProgramada !== undefined && {
          fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
        }),
        ...(fechaEjecucion !== undefined && {
          fechaEjecucion: fechaEjecucion ? new Date(fechaEjecucion) : null,
        }),
        ...(fechaFinalizacion !== undefined && {
          fechaFinalizacion: fechaFinalizacion ? new Date(fechaFinalizacion) : null,
        }),
        ...(seguimientoDetalle !== undefined && { seguimientoDetalle }),
        ...(seguimientoEvidenciaUrl1 !== undefined && { seguimientoEvidenciaUrl1 }),
        ...(seguimientoEvidenciaUrl2 !== undefined && { seguimientoEvidenciaUrl2 }),
        ...(estado && { estado }),
        ...(prioridad !== undefined && { prioridad: Number(prioridad) }),
        ...(presupuesto !== undefined && { presupuesto: Number(presupuesto) }),
        ...(porcentajeAvance !== undefined && {
          porcentajeAvance: Number(porcentajeAvance),
        }),
        ...(observaciones !== undefined && { observaciones }),
      },
    });

    await dispararRecalculoResidualPorPlanes(existing, plan);

    res.json(plan);
  } catch (error) {
    if ((error as any).code === "P2025") {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.status(500).json({ error: "Error updating plan" });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.id);

    const existing = await prisma.planAccion.findUnique({
      where: { id: planId },
    });
    if (!existing) {
      return res.status(404).json({ error: "No se encontró el plan de acción o ya fue eliminado." });
    }

    await prisma.planAccion.delete({
      where: { id: planId },
    });

    await dispararRecalculoResidualPorPlanes(existing, {});

    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    const e = error as any;
    if (e?.code === "P2025") return res.status(404).json({ error: "No se encontró el plan de acción o ya fue eliminado." });
    if (e?.code === "P2003") return res.status(400).json({ error: "No se puede eliminar el plan porque tiene tareas asociadas." });
    res.status(500).json({ error: "Error al eliminar el plan de acción" });
  }
};

export const getPlanesVencidos = async (req: Request, res: Response) => {
  try {
    const today = new Date();

    const planes = await prisma.planAccion.findMany({
      where: {
        AND: [
          { fechaProgramada: { lt: today } },
          { estado: { not: "Completado" } },
        ],
      },
    });

    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: "Error fetching planes vencidos" });
  }
};

export const getPlanesEstadisticas = async (req: Request, res: Response) => {
  try {
    const todos = await prisma.planAccion.findMany();

    const estadisticas = {
      total: todos.length,
      porEstado: {
        planeado: todos.filter((p) => p.estado === "Planeado").length,
        enEjecucion: todos.filter((p) => p.estado === "En ejecución").length,
        completado: todos.filter((p) => p.estado === "Completado").length,
        vencido: todos.filter((p) => p.estado === "Vencido").length,
      },
      preventivos: todos.filter((p) => p.riesgoId && !p.incidenciaId).length,
      reactivos: todos.filter((p) => p.incidenciaId && !p.riesgoId).length,
    };

    res.json(estadisticas);
  } catch (error) {
    res.status(500).json({ error: "Error fetching estadisticas" });
  }
};
