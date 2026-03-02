/**
 * Consulta la base de datos y guarda en un MD TODA la información usada para la clasificación residual:
 * - Tablas del admin (las que se editan en Configuración Residual): pesos, rangos evaluación, tabla mitigación, rangos nivel, opciones de criterios
 * - Causas con control: Frecuencia residual, Impacto residual, Calificación de la causa residual
 * - EvaluacionRiesgo: Calificación del riesgo residual (mapa)
 *
 * Objetivo: ver si la info ingresada en la BD es correcta y sirve para calcular bien el riesgo residual.
 *
 * Uso: npx tsx scripts/consulta-bd-clasificacion-residual.ts
 * Genera: analisis/consulta_bd_clasificacion_residual.md
 */

import * as fs from 'fs';
import * as path from 'path';
import prisma from '../src/prisma';

function mdTable(headers: string[], rows: (string | number | null)[][]): string {
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const headerLine = '| ' + headers.join(' | ') + ' |';
  const bodyLines = rows.map((r) => '| ' + r.map((c) => (c == null ? '' : String(c))).join(' | ') + ' |');
  return [headerLine, sep, ...bodyLines].join('\n');
}

async function main() {
  const outPath = path.join(__dirname, '../../analisis/consulta_bd_clasificacion_residual.md');
  let md = `# Consulta base de datos — Clasificación Residual

**Generado:** ${new Date().toISOString()}

Este documento trae **toda** la información de la BD usada para la clasificación residual: tablas del admin (Configuración Residual) y datos de causas/evaluaciones. Sirve para revisar si la **info ingresada es correcta** y **sirve para calcular bien** el riesgo residual.

---

`;

  try {
    const config = await prisma.configuracionResidual.findFirst({
      where: { activa: true },
      include: {
        pesosCriterios: { orderBy: { orden: 'asc' } },
        rangosEvaluacion: { orderBy: { orden: 'asc' } },
        tablaMitigacion: { orderBy: { orden: 'asc' } },
        rangosNivelRiesgo: { orderBy: { orden: 'asc' } },
        opcionesCriterios: { orderBy: [{ criterio: 'asc' }, { orden: 'asc' }] },
      },
    });

    if (!config) {
      md += `## ⚠️ No hay configuración residual activa

No se encontró \`ConfiguracionResidual\` con \`activa = true\`. Sin config no se puede calcular bien el riesgo residual.

`;
    } else {
      md += `## 1. Configuración residual activa

| Campo | Valor |
|-------|-------|
| id | ${config.id} |
| nombre | ${config.nombre} |
| activa | ${config.activa} |
| descripcion | ${config.descripcion ?? '(vacío)'} |

---

## 2. Tablas del admin — Pesos de Criterios (PesoCriterioResidual)

Usados para: \`puntajeTotal = Σ (puntajeCriterio × peso)\`. La suma debe ser **100%** para calcular bien.

`;
      md += mdTable(
        ['criterio', 'peso', 'peso %', 'orden', 'activo'],
        config.pesosCriterios.map((p) => [p.criterio, p.peso, (p.peso * 100).toFixed(0) + '%', p.orden, p.activo ? 'Sí' : 'No'])
      );
      const sumaPesos = config.pesosCriterios.reduce((s, p) => s + p.peso, 0);
      md += `\n**Suma pesos:** ${sumaPesos.toFixed(4)} ${Math.abs(sumaPesos - 1.0) < 0.01 ? '✅ (100%)' : '⚠️ Debe ser 1.0 (100%)'}\n\n---\n\n`;

      md += `## 3. Tablas del admin — Rangos de Evaluación (RangoEvaluacionResidual)

Definen la **evaluación preliminar** del control según el puntaje total (Inefectivo … Altamente Efectivo). Deben cubrir bien el rango 0–100 para calcular bien.

`;
      md += mdTable(
        ['nivelNombre', 'valorMinimo', 'valorMaximo', 'incluirMinimo', 'incluirMaximo', 'orden', 'activo'],
        config.rangosEvaluacion.map((r) => [
          r.nivelNombre,
          r.valorMinimo,
          r.valorMaximo,
          r.incluirMinimo ? 'Sí' : 'No',
          r.incluirMaximo ? 'Sí' : 'No',
          r.orden,
          r.activo ? 'Sí' : 'No',
        ])
      );
      md += '\n\n---\n\n';

      md += `## 4. Tablas del admin — Tabla de Mitigación (TablaMitigacionResidual)

Por cada **evaluación definitiva** del control, el % de mitigación usado para Frecuencia residual e Impacto residual. Debe tener todas las evaluaciones (Inefectivo, Baja Efectividad, … Altamente Efectivo) para calcular bien.

`;
      md += mdTable(
        ['evaluacion', 'porcentaje', 'orden', 'activo'],
        config.tablaMitigacion.map((t) => [t.evaluacion, t.porcentaje, t.orden, t.activo ? 'Sí' : 'No'])
      );
      md += '\n\n---\n\n';

      md += `## 5. Tablas del admin — Rangos de Nivel de Riesgo Residual (RangoNivelRiesgoResidual)

Definen el **nivel** (Crítico, Alto, Medio, Bajo) según la Calificación de la causa residual. Deben cubrir el rango de calificaciones (ej. 1–25) para calcular bien.

`;
      md += mdTable(
        ['nivelNombre', 'valorMinimo', 'valorMaximo', 'incluirMinimo', 'incluirMaximo', 'orden', 'activo'],
        config.rangosNivelRiesgo.map((r) => [
          r.nivelNombre,
          r.valorMinimo,
          r.valorMaximo,
          r.incluirMinimo ? 'Sí' : 'No',
          r.incluirMaximo ? 'Sí' : 'No',
          r.orden,
          r.activo ? 'Sí' : 'No',
        ])
      );
      md += '\n\n---\n\n';

      md += `## 6. Tablas del admin — Opciones de Criterios (OpcionCriterioResidual)

Opciones de cada dropdown y su **valor** numérico. El usuario elige una por criterio; ese valor se guarda en \`gestion\` (puntajeAplicabilidad, puntajeCobertura, etc.) y se usa en el puntaje total. Deben estar completas para calcular bien.

### Aplicabilidad
`;
      md += mdTable(
        ['label', 'valor', 'orden', 'activo'],
        config.opcionesCriterios.filter((o) => o.criterio === 'aplicabilidad').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
      );
      md += '\n### Cobertura\n';
      md += mdTable(
        ['label', 'valor', 'orden', 'activo'],
        config.opcionesCriterios.filter((o) => o.criterio === 'cobertura').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
      );
      md += '\n### Facilidad\n';
      md += mdTable(
        ['label', 'valor', 'orden', 'activo'],
        config.opcionesCriterios.filter((o) => o.criterio === 'facilidad').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
      );
      md += '\n### Segregación\n';
      md += mdTable(
        ['label', 'valor', 'orden', 'activo'],
        config.opcionesCriterios.filter((o) => o.criterio === 'segregacion').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
      );
      md += '\n### Naturaleza\n';
      md += mdTable(
        ['label', 'valor', 'orden', 'activo'],
        config.opcionesCriterios.filter((o) => o.criterio === 'naturaleza').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
      );
      md += '\n\n---\n\n';
    }

    md += `## 7. Causas con control — Frecuencia residual, Impacto residual, Calificación de la causa residual

Datos ya calculados por causa (guardados en \`CausaRiesgo.gestion\`). Si faltan o están en 0, el recálculo no las está actualizando o la causa no tiene datos de control suficientes.

`;

    const causas = await prisma.causaRiesgo.findMany({
      where: {
        tipoGestion: { in: ['CONTROL', 'AMBOS'] },
        gestion: { not: null },
      },
      select: {
        id: true,
        riesgoId: true,
        descripcion: true,
        tipoGestion: true,
        gestion: true,
      },
      orderBy: [{ riesgoId: 'asc' }, { id: 'asc' }],
    });

    const filasCausas: (string | number | null)[][] = [];
    for (const c of causas) {
      const g = c.gestion as any;
      if (!g) continue;
      filasCausas.push([
        c.id,
        c.riesgoId,
        (c.descripcion || '').slice(0, 40),
        c.tipoGestion || '',
        g.puntajeTotal ?? g.puntajeAplicabilidad ?? '-',
        g.evaluacionDefinitiva ?? '-',
        g.frecuenciaResidual ?? '-',
        g.impactoResidual ?? '-',
        g.calificacionResidual ?? '-',
        g.nivelRiesgoResidual ?? '-',
      ]);
    }

    md += mdTable(
      ['causa id', 'riesgo id', 'descripción', 'tipo', 'puntaje total', 'evaluación definitiva', 'Frecuencia residual', 'Impacto residual', 'Calificación de la causa residual', 'nivel'],
      filasCausas.length ? filasCausas : [['(ninguna con CONTROL/AMBOS y gestion)', '-', '-', '-', '-', '-', '-', '-', '-', '-']]
    );
    md += '\n\n---\n\n';

    md += `## 8. Calificación del riesgo residual (por riesgo) — mapa residual

Campos en \`EvaluacionRiesgo\` que usa el mapa de riesgos residual (posición por probabilidadResidual, impactoResidual). Provienen de la causa con mayor Calificación de la causa residual del riesgo.

`;

    const evaluaciones = await prisma.evaluacionRiesgo.findMany({
      where: {
        OR: [
          { probabilidadResidual: { not: null } },
          { impactoResidual: { not: null } },
          { riesgoResidual: { not: null } },
        ],
      },
      select: {
        riesgoId: true,
        probabilidad: true,
        impactoMaximo: true,
        riesgoInherente: true,
        nivelRiesgo: true,
        probabilidadResidual: true,
        impactoResidual: true,
        riesgoResidual: true,
        nivelRiesgoResidual: true,
      },
      orderBy: { riesgoId: 'asc' },
    });

    const filasEval = evaluaciones.map((e) => [
      e.riesgoId,
      e.probabilidad ?? '-',
      e.impactoMaximo ?? '-',
      e.riesgoInherente ?? '-',
      e.nivelRiesgo ?? '-',
      e.probabilidadResidual ?? '-',
      e.impactoResidual ?? '-',
      e.riesgoResidual ?? '-',
      e.nivelRiesgoResidual ?? '-',
    ]);

    md += mdTable(
      ['riesgo id', 'prob inherente', 'impacto max', 'riesgo inh', 'nivel inh', 'probabilidadResidual', 'impactoResidual', 'riesgoResidual', 'nivelRiesgoResidual'],
      filasEval.length ? filasEval : [['(ninguna evaluación con residual)', '-', '-', '-', '-', '-', '-', '-', '-']]
    );
    md += '\n\n---\n\n';

    // Verificación frente al documento Excel: BY/BZ 1..5, CA = 2×2→3.99, si no BY×BZ
    const incoherenciasCA: { causaId: number; BY: number; BZ: number; CA_guardado: number; CA_esperado: number }[] = [];
    const causasFueraRango: { causaId: number; BY: number; BZ: number }[] = [];
    for (const c of causas) {
      const g = c.gestion as any;
      if (!g || g.frecuenciaResidual == null || g.impactoResidual == null) continue;
      const by = Number(g.frecuenciaResidual);
      const bz = Number(g.impactoResidual);
      if (by < 1 || by > 5 || bz < 1 || bz > 5) {
        causasFueraRango.push({ causaId: c.id, BY: by, BZ: bz });
        continue;
      }
      const caGuardado = Number(g.calificacionResidual);
      const caEsperado = by === 2 && bz === 2 ? 3.99 : by * bz;
      const ok = Math.abs(caGuardado - caEsperado) < 0.01;
      if (!ok) incoherenciasCA.push({ causaId: c.id, BY: by, BZ: bz, CA_guardado: caGuardado, CA_esperado });
    }

    md += `## 9. Verificación frente al documento Excel (cálculo bien aplicado)

Reglas que debe cumplir el cálculo para estar alineado con la plantilla:

- **Frecuencia residual (BY)** y **Impacto residual (BZ)**: valores enteros 1..5.
- **Calificación de la causa residual (CA)**: si BY=2 y BZ=2 → **3.99**; en cualquier otro caso → **BY × BZ**.
- **Calificación del riesgo residual (CB)**: por cada riesgo se toma la **causa con mayor CA**; el mapa usa la **frecuencia e impacto residual de esa causa** (probabilidadResidual, impactoResidual en EvaluacionRiesgo).

**Comprobación CA por causa:** para cada fila de la sección 7 se aplica la fórmula anterior al BY y BZ guardados; el CA guardado debe coincidir.

| Verificación | Resultado |
|--------------|-----------|
| BY y BZ en rango 1..5 | ${causasFueraRango.length === 0 ? `✅ Todas` : `⚠️ ${causasFueraRango.length} causa(s) con BY/BZ fuera de 1..5`} |
| Causas con CA coherente con fórmula (2×2→3.99, resto BY×BZ) | ${incoherenciasCA.length === 0 ? `✅ Todas (${filasCausas.length}) coherentes` : `⚠️ ${incoherenciasCA.length} causa(s) con posible incoherencia`} |
`;

    if (causasFueraRango.length > 0) {
      md += `\nCausas con frecuencia o impacto residual fuera de 1..5:\n\n`;
      md += mdTable(
        ['causa id', 'BY', 'BZ'],
        causasFueraRango.slice(0, 15).map((x) => [x.causaId, x.BY, x.BZ])
      );
      if (causasFueraRango.length > 15) md += `\n... y ${causasFueraRango.length - 15} más.\n`;
      md += '\n';
    }

    if (incoherenciasCA.length > 0) {
      md += `\nCausas con CA guardado distinto al esperado por la fórmula:\n\n`;
      md += mdTable(
        ['causa id', 'BY', 'BZ', 'CA guardado', 'CA esperado (fórmula)'],
        incoherenciasCA.slice(0, 20).map((x) => [x.causaId, x.BY, x.BZ, x.CA_guardado, x.CA_esperado])
      );
      if (incoherenciasCA.length > 20) md += `\n... y ${incoherenciasCA.length - 20} más.\n`;
      md += '\nReejecuta **Recalcular** en Admin para volver a calcular con la fórmula correcta.\n\n';
    }

    md += `---

## 10. Resumen: ¿la info sirve para calcular bien el riesgo residual?

| Revisión | Estado |
|----------|--------|
| Hay configuración residual activa | ${config ? '✅ Sí' : '❌ No'} |
| Suma de pesos = 100% | ${config ? (Math.abs(config.pesosCriterios.reduce((s, p) => s + p.peso, 0) - 1.0) < 0.01 ? '✅ Sí' : '⚠️ Revisar') : '—'} |
| Rangos de evaluación cubren 0–100 | ${config && config.rangosEvaluacion.length >= 5 ? '✅ Revisar valores arriba' : config ? '⚠️ Revisar' : '—'} |
| Tabla mitigación tiene todas las evaluaciones | ${config && config.tablaMitigacion.length >= 5 ? '✅ Revisar valores arriba' : config ? '⚠️ Revisar' : '—'} |
| Rangos de nivel riesgo residual definidos | ${config && config.rangosNivelRiesgo.length >= 1 ? '✅ Revisar valores arriba' : config ? '⚠️ Revisar' : '—'} |
| Opciones de criterios (todas las dimensiones) | ${config && config.opcionesCriterios.length >= 10 ? '✅ Revisar valores arriba' : config ? '⚠️ Revisar' : '—'} |
| BY/BZ en rango 1..5 por causa | ${causasFueraRango.length === 0 ? '✅ Sí' : '⚠️ Ver sección 9'} |
| Fórmula CA coherente (2×2→3.99, resto BY×BZ) | ${incoherenciasCA.length === 0 ? '✅ Sí' : '⚠️ Ver sección 9'} |
| Causas con CONTROL/AMBOS y datos de gestión | **${filasCausas.length}** |
| Evaluaciones con residual (mapa) | **${filasEval.length}** |

Si todo lo anterior está correcto, la info ingresada en la BD **sirve para calcular bien** el riesgo residual según el documento Excel. Si algo falla, ajusta en Admin > Configuración Residual y vuelve a ejecutar **Recalcular**.
`;

    fs.writeFileSync(outPath, md, 'utf-8');
    console.log('✅ Consulta guardada:', outPath);
  } catch (e: any) {
    console.error('Error:', e?.message || e);
    md += `\n## Error\n\n\`\`\`\n${e?.message || e}\n\`\`\`\n`;
    fs.writeFileSync(outPath, md, 'utf-8');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
