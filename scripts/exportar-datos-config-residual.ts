/**
 * Script de solo lectura: exporta los datos actuales de las tablas de
 * configuración residual a un archivo Markdown para revisar que los valores
 * ingresados en la base sean correctos para los cálculos.
 *
 * Uso: npx tsx scripts/exportar-datos-config-residual.ts
 *
 * Genera: analisis/datos_tablas_config_residual.md
 */

import * as fs from 'fs';
import * as path from 'path';
import prisma from '../src/prisma';

function mdTable(headers: string[], rows: (string | number)[][]): string {
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const headerLine = '| ' + headers.join(' | ') + ' |';
  const bodyLines = rows.map((r) => '| ' + r.join(' | ') + ' |');
  return [headerLine, sep, ...bodyLines].join('\n');
}

async function main() {
  const outPath = path.join(__dirname, '../../analisis/datos_tablas_config_residual.md');

  let md = `# Datos actuales en tablas de Configuración Residual

**Generado:** ${new Date().toISOString()}

Este documento es de **solo lectura**: refleja el contenido actual de la base de datos para revisar que los valores sean correctos para los cálculos (BY, BZ, CA, puntaje total, etc.).

---

`;

  try {
    // Configuración activa
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

No se encontró ninguna fila en \`ConfiguracionResidual\` con \`activa = true\`.
Ejecuta el seed de configuración residual si aún no lo has hecho:

\`\`\`bash
npx tsx prisma/seed-configuracion-residual.ts
\`\`\`
`;
      fs.writeFileSync(outPath, md, 'utf-8');
      console.log('Escrito:', outPath);
      return;
    }

    md += `## 1. Configuración activa

| Campo | Valor |
|-------|-------|
| id | ${config.id} |
| nombre | ${config.nombre} |
| activa | ${config.activa} |
| descripcion | ${config.descripcion ?? '(vacío)'} |

---

## 2. Pesos de Criterios (PesoCriterioResidual)

Usados en: \`puntajeTotal = Σ (puntajeCriterio × peso)\`. La suma debe ser 1.0 (100%).

${mdTable(
  ['criterio', 'peso', 'peso %', 'orden', 'activo'],
  config.pesosCriterios.map((p) => [
    p.criterio,
    p.peso,
    (p.peso * 100).toFixed(0) + '%',
    p.orden,
    p.activo ? 'Sí' : 'No',
  ])
)}

**Suma pesos:** ${config.pesosCriterios.reduce((s, p) => s + p.peso, 0).toFixed(4)} ${Math.abs(config.pesosCriterios.reduce((s, p) => s + p.peso, 0) - 1.0) < 0.01 ? '✅ (100%)' : '⚠️ (debe ser 1.0)'}

---

## 3. Rangos de Evaluación (RangoEvaluacionResidual)

Determinan la **evaluación preliminar** del control según el puntaje total (Inefectivo, Baja Efectividad, … Altamente Efectivo).

${mdTable(
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
)}

---

## 4. Tabla de Mitigación (TablaMitigacionResidual)

Por cada **evaluación definitiva** del control, define el % de mitigación usado para calcular BY (frecuencia residual) y BZ (impacto residual).

${mdTable(
  ['evaluacion', 'porcentaje', 'orden', 'activo'],
  config.tablaMitigacion.map((t) => [t.evaluacion, t.porcentaje, t.orden, t.activo ? 'Sí' : 'No'])
)}

---

## 5. Rangos de Nivel de Riesgo Residual (RangoNivelRiesgoResidual)

Determinan el **nivel** (Crítico, Alto, Medio, Bajo) según la calificación residual (CA) de la causa.

${mdTable(
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
)}

---

## 6. Opciones de Criterios (OpcionCriterioResidual)

Opciones de cada dropdown y su **valor** numérico (se guarda en \`gestion\` como puntajeAplicabilidad, puntajeCobertura, etc.).

### 6.1 Aplicabilidad

${mdTable(
  ['label', 'valor', 'orden', 'activo'],
  config.opcionesCriterios.filter((o) => o.criterio === 'aplicabilidad').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
)}

### 6.2 Cobertura

${mdTable(
  ['label', 'valor', 'orden', 'activo'],
  config.opcionesCriterios.filter((o) => o.criterio === 'cobertura').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
)}

### 6.3 Facilidad

${mdTable(
  ['label', 'valor', 'orden', 'activo'],
  config.opcionesCriterios.filter((o) => o.criterio === 'facilidad').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
)}

### 6.4 Segregación

${mdTable(
  ['label', 'valor', 'orden', 'activo'],
  config.opcionesCriterios.filter((o) => o.criterio === 'segregacion').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
)}

### 6.5 Naturaleza

${mdTable(
  ['label', 'valor', 'orden', 'activo'],
  config.opcionesCriterios.filter((o) => o.criterio === 'naturaleza').map((o) => [o.label, o.valor, o.orden, o.activo ? 'Sí' : 'No'])
)}

---

## Resumen

- **Pesos:** ${config.pesosCriterios.length} criterios.
- **Rangos evaluación:** ${config.rangosEvaluacion.length} niveles.
- **Tabla mitigación:** ${config.tablaMitigacion.length} evaluaciones.
- **Rangos nivel riesgo:** ${config.rangosNivelRiesgo.length} niveles.
- **Opciones criterios:** ${config.opcionesCriterios.length} opciones en total.
`;

    fs.writeFileSync(outPath, md, 'utf-8');
    console.log('✅ Exportado:', outPath);
  } catch (e) {
    console.error('Error:', e);
    md += `\n## ❌ Error al leer la base de datos\n\n\`\`\`\n${e}\n\`\`\`\n`;
    fs.writeFileSync(outPath, md, 'utf-8');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
