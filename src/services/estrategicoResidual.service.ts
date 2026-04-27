/**
 * Recálculo residual modo ESTRATEGICO (CWR / Anexo 6).
 */

import prisma from '../prisma';
import { getRangosNivelRiesgo } from './configuracionResidual.service';
import {
  computeStrategicResidualRow,
  normalizarTipoMitigacionAnexo,
} from './estrategicoResidual.engine';
import { getStrategicEngineConfigResolved } from './estrategicoResidualConfig.service';
import { debeForzarResidualIgualInherentePorPlanesCausa } from './reglaResidualPlanCausa.service';

const LOG_PREFIX = '[ResidualEstrategico]';
const CLAS_POS = 'Riesgo con consecuencia positiva';

/** Evita fallos al guardar 3.99 si la BD aún no migró la columna a double. */
let ensuredRiesgoResidualFloatColumn = false;

async function ensureEvaluacionRiesgoResidualColumnFloat(): Promise<void> {
  if (ensuredRiesgoResidualFloatColumn) return;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(`
      SELECT t.typname::text AS typname
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid AND c.relkind = 'r'
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_type t ON a.atttypid = t.oid
      WHERE n.nspname = 'public'
        AND c.relname = 'EvaluacionRiesgo'
        AND a.attname = 'riesgoResidual'
        AND a.attnum > 0
        AND NOT a.attisdropped
      LIMIT 1
    `);
    const typ = rows[0]?.typname;
    if (typ === 'int4' || typ === 'int8') {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "EvaluacionRiesgo" ALTER COLUMN "riesgoResidual" TYPE DOUBLE PRECISION USING "riesgoResidual"::DOUBLE PRECISION'
      );
      console.log(`${LOG_PREFIX} Columna riesgoResidual → DOUBLE PRECISION (paridad Excel 3,99).`);
    }
  } catch (e) {
    console.warn(
      `${LOG_PREFIX} Aviso: no se pudo auto-ajustar tipo de riesgoResidual (¿no es PostgreSQL?).`,
      (e as Error)?.message
    );
  } finally {
    ensuredRiesgoResidualFloatColumn = true;
  }
}

type FreqRow = { id: number; label: string; peso: number | null };

function resolverFrecuenciaCausaA1_5(
  causaFrecuencia: string | null | undefined,
  frecuenciasCatalog: FreqRow[]
): number | null {
  if (causaFrecuencia == null || String(causaFrecuencia).trim() === '') return null;
  const s = String(causaFrecuencia).trim();
  if (/^\d+$/.test(s)) {
    const freqId = parseInt(s, 10);
    const f = frecuenciasCatalog.find((fc) => fc.id === freqId);
    const p = f?.peso ?? f?.id ?? freqId;
    return Math.max(1, Math.min(5, Math.round(Number(p))));
  }
  const f = frecuenciasCatalog.find((fc) => fc.label?.toLowerCase() === s.toLowerCase());
  const p = f?.peso ?? f?.id ?? 3;
  return Math.max(1, Math.min(5, Math.round(Number(p))));
}

function determinarNivelRiesgoResidual(calificacionResidual: number, rangos: any[]): string {
  for (const rango of rangos) {
    const cumpleMinimo = rango.incluirMinimo
      ? calificacionResidual >= rango.valorMinimo
      : calificacionResidual > rango.valorMinimo;
    const cumpleMaximo = rango.incluirMaximo
      ? calificacionResidual <= rango.valorMaximo
      : calificacionResidual < rango.valorMaximo;
    if (cumpleMinimo && cumpleMaximo) return rango.nivelNombre;
  }
  return 'NIVEL BAJO';
}

export async function recalcularResidualEstrategicoPorRiesgo(riesgoId: number): Promise<void> {
  const riesgo = await prisma.riesgo.findUnique({
    where: { id: riesgoId },
    include: {
      proceso: true,
      evaluacion: true,
      causas: { include: { controles: true } },
    },
  });

  if (!riesgo?.evaluacion || !riesgo.proceso) return;
  if (riesgo.proceso.calificacionModo !== 'ESTRATEGICO') return;

  await ensureEvaluacionRiesgoResidualColumnFloat();

  const ev = riesgo.evaluacion;

  if (riesgo.clasificacion === CLAS_POS) {
    await prisma.evaluacionRiesgo.update({
      where: { riesgoId },
      data: {
        probabilidadResidual: ev.probabilidad,
        impactoResidual: ev.impactoGlobal,
        riesgoResidual: Math.round(Number(ev.riesgoInherente)),
        nivelRiesgoResidual: ev.nivelRiesgo || 'NIVEL BAJO',
      },
    });
    return;
  }

  if (await debeForzarResidualIgualInherentePorPlanesCausa(riesgoId)) {
    const riInh =
      ev.riesgoInherente != null
        ? Number(ev.riesgoInherente)
        : Number(ev.probabilidad ?? 1) * Number(ev.impactoGlobal ?? 1);
    await prisma.evaluacionRiesgo.update({
      where: { riesgoId },
      data: {
        probabilidadResidual: ev.probabilidad,
        impactoResidual: ev.impactoGlobal,
        riesgoResidual: riInh,
        nivelRiesgoResidual: ev.nivelRiesgo || 'Sin Calificar',
      },
    });
    console.log(
      `${LOG_PREFIX} Riesgo ${riesgoId}: regla plan-en-causa activa; residual = inherente (sin motor MA).`
    );
    return;
  }

  const frecuenciasCatalog = await prisma.frecuenciaCatalog.findMany();
  const fcRows: FreqRow[] = frecuenciasCatalog.map((r) => ({
    id: r.id,
    label: r.label,
    peso: r.peso,
  }));

  const Y = Math.max(1, Math.min(5, Math.round(Number(ev.impactoGlobal ?? 1))));
  const rangosNivel = await getRangosNivelRiesgo();
  const engineCfg = await getStrategicEngineConfigResolved();

  let best: { BD: number; BB: number; BC: number } | null = null;

  for (const causa of riesgo.causas) {
    const R =
      resolverFrecuenciaCausaA1_5(causa.frecuencia, fcRows) ??
      Math.max(1, Math.min(5, Math.round(Number(ev.probabilidad ?? 1))));

    for (const control of causa.controles) {
      const AN = normalizarTipoMitigacionAnexo(control.tipoMitigacionAnexo);
      if (!AN) continue;

      const row = computeStrategicResidualRow(
        {
          R,
          Y,
          AN,
          presupuesto: control.maPresupuesto || '',
          actitud: control.maActitud || '',
          cap: control.maCapacitacion || '',
          doc: control.maDocumentacion || '',
          mon: control.maMonitoreo || '',
          clasificacionRiesgo: riesgo.clasificacion || '',
          akPositivo: Number(ev.riesgoInherente),
        },
        engineCfg
      );

      if (!row) continue;

      await prisma.controlRiesgo.update({
        where: { id: control.id },
        data: {
          maPuntajeAy: row.AY,
          maEvaluacionAz: row.AZ,
          maPorcentajeBa: row.BA,
          evaluacionPreliminar: row.AZ,
          evaluacionDefinitiva: row.AZ,
          recalculadoEn: new Date(),
        },
      });

      if (!best || row.BD > best.BD) {
        best = { BD: row.BD, BB: row.BB, BC: row.BC };
      }
    }
  }

  if (!best) {
    await prisma.evaluacionRiesgo.update({
      where: { riesgoId },
      data: {
        probabilidadResidual: ev.probabilidad,
        impactoResidual: ev.impactoGlobal,
        riesgoResidual: Math.round(Number(ev.riesgoInherente)),
        nivelRiesgoResidual: ev.nivelRiesgo || 'Sin Calificar',
      },
    });
    console.log(`${LOG_PREFIX} Riesgo ${riesgoId}: sin controles MA completos; residual = inherente.`);
    return;
  }

  const nivel = determinarNivelRiesgoResidual(best.BD, rangosNivel);

  await prisma.evaluacionRiesgo.update({
    where: { riesgoId },
    data: {
      probabilidadResidual: Math.round(best.BB),
      impactoResidual: Math.round(best.BC),
      riesgoResidual: best.BD,
      nivelRiesgoResidual: nivel,
    },
  });

  console.log(
    `${LOG_PREFIX} Riesgo ${riesgoId}: BD=${best.BD} BB=${best.BB} BC=${best.BC} nivel=${nivel}`
  );
}

/** Recalcula residual estratégico para todos los riesgos cuyo proceso está en modo ESTRATEGICO. */
export async function recalcularTodosRiesgosEstrategicos(): Promise<{
  procesados: number;
  errores: string[];
}> {
  await ensureEvaluacionRiesgoResidualColumnFloat();
  const errores: string[] = [];
  const riesgos = await prisma.riesgo.findMany({
    where: { proceso: { calificacionModo: 'ESTRATEGICO' } },
    select: { id: true },
  });
  const LOTE = 15;
  for (let i = 0; i < riesgos.length; i += LOTE) {
    const lote = riesgos.slice(i, i + LOTE);
    await Promise.all(
      lote.map(async (r) => {
        try {
          await recalcularResidualEstrategicoPorRiesgo(r.id);
        } catch (e: any) {
          errores.push(`Riesgo ${r.id}: ${e?.message ?? e}`);
        }
      })
    );
  }
  return { procesados: riesgos.length, errores };
}
