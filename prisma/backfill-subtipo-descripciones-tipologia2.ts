/**
 * Rellena "SubtipoRiesgo"."descripcion" solo cuando está vacía o es null,
 * para tipología nivel II (Estratégico y Cumplimiento según catálogo oficial).
 *
 * Uso: desde gestion_riesgos_backend con DATABASE_URL en .env
 *   npm run backfill:subtipo-descripciones
 *
 * Tras ejecutar, invalidar caché Redis de catálogos (o esperar TTL ~5 min)
 * si aplica en tu entorno.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type Patch = { tipoNombre: string; subtipoNombre: string; descripcion: string };

/** Textos alineados al catálogo de tipología nivel II (sin hardcode en frontend). */
const PATCHES: Patch[] = [
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Político',
        descripcion:
            'Es el riesgo que emerge debido a la exposición de la compañía a situaciones políticas nacionales y/o internacionales adversas, tensiones geopolíticas, o guerra.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Mercado',
        descripcion:
            'Cambios en las condiciones macroeconómicas y/o sectoriales relevantes para el negocio, fluctuaciones en precios y/o indisponibilidad de inventario para comercializar.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Competencia',
        descripcion: 'Acciones de competidores o nuevos jugadores en el mercado.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Continuidad del negocio',
        descripcion:
            'Eventos mayores (natural u ocasionado por el hombre) que afecten o inhabiliten la operación de la compañía.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Alianzas',
        descripcion: 'Alianzas comerciales ineficientes y/o inefectivas y/o no rentables.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Canales de distribución',
        descripcion:
            'Fallas en los canales de distribución que afectan la capacidad de la compañía de llegar a los clientes.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Capacidad Industrial',
        descripcion: 'Riesgos de obsolescencia tecnológica y/o ineficiente uso de activos críticos.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Satisfacción del cliente',
        descripcion:
            'Fallo en la identificación de preferencias/necesidades de los clientes para la atracción de nuevos clientes y mantenimiento de la lealtad de los existentes, y/o en la ejecución de las estrategias de entrega de soluciones integrales a los clientes.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Talento Humano',
        descripcion:
            'Riesgo asociado con la falta y/o pérdida de funcionarios clave en la compañía, y/o en la atracción, desarrollo y retención de funcionarios competentes.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Alineación Estratégica',
        descripcion:
            'Inexistencia, desconocimiento y/o falta de alineación entre la misión, visión, estrategias y los objetivos de negocio y proyectos de alto impacto de las unidades de negocio.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Cultura Organizacional',
        descripcion:
            'Fallas en la alineación de los funcionarios con la misión, visión y objetivos estratégicos de la compañía, fallas en la transmisión de conocimiento, y aceptación de cambios en la compañía.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Rentabilidad',
        descripcion: 'Posibilidad de no cumplir con la maximización del ROE presupuestado.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Proyecto',
        descripcion:
            'Riesgo de fallas en los estándares de gerencia de proyectos, incluidas las actividades de gobierno, actividades de monitoreo y control, manejo de presupuesto. Inhabilidad de mantener el alcance del proyecto y cronograma, así como fallar en la entrega exitosa del proyecto y la asociada gestión del cambio.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Grupo',
        descripcion:
            'Potenciales pérdidas producto de transacciones con empresas del mismo grupo realizadas en condiciones distintas a las dominantes en el mercado, efectos negativos en la compañía producto de problemas reputacionales y/o económicos en otra empresa del grupo, concentración de operaciones con otra empresa del mismo grupo.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Emergentes',
        descripcion:
            'Un riesgo emergente es un evento cuya naturaleza y consecuencias no se conocen completamente y que podrían llegar a tener un gran impacto en la compañía. Estos usualmente suceden a gran escala y surgen de tendencias globales.',
    },
    {
        tipoNombre: 'Estratégico',
        subtipoNombre: 'Proyecto Estratégico',
        descripcion:
            'Riesgo de fallas en los estándares de gerencia de proyectos, incluidas las actividades de gobierno, actividades de monitoreo y control, manejo de presupuesto. Inhabilidad de mantener el alcance del proyecto y cronograma, así como fallar en la entrega exitosa del proyecto y la asociada gestión del cambio. Esta tipología se debe seleccionar cuando se trata de un proyecto de gran envergadura que afecta directamente el plan estratégico de la compañía.',
    },
    {
        tipoNombre: 'Cumplimiento',
        subtipoNombre: 'LAFT y PADM',
        descripcion:
            'Son los riesgos que se podrían materializar en el caso de que la compañía sea utilizada para lavar activos o financiar el terrorismo o proliferar armas de destrucción masiva.',
    },
    {
        tipoNombre: 'Cumplimiento',
        subtipoNombre: 'Soborno y Corrupción',
        descripcion:
            'Es el riesgo de que funcionarios de la empresa influencien o sean influenciados por medio del pago de dádivas, regalos y/o favores, ya sea de forma directa o indirecta, con el fin de obtener y/o propiciar un negocio u otra ventaja por parte de un tercero, ya sea público o privado.',
    },
];

function isEmptyDescription(d: string | null | undefined): boolean {
    return d == null || String(d).trim() === '';
}

/** Compara nombres ignorando mayúsculas y tildes (p. ej. Estrategico ≈ Estratégico). */
function foldName(s: string): string {
    return s
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim()
        .toLowerCase();
}

/** Quita prefijos tipo "01 " o "04 - " para alinear con catálogos sin código en UI. */
function tipoFoldKey(nombre: string): string {
    return foldName(nombre).replace(/^[\d.\s_-]+/, '').trim();
}

/** Último segmento tras " - " (p. ej. "Estratégico - Competencia" → "competencia"). */
function subtipoMatchKey(nombre: string): string {
    const f = foldName(nombre);
    const parts = f.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : f;
}

/** Quita ruido habitual (prefijo "Subtipo ", del/de, caracteres sustitutos) para emparejar con catálogo limpio. */
function subtipoCompareKey(nombre: string): string {
    let s = subtipoMatchKey(nombre).replace(/^subtipo\s+/i, '');
    s = s.replace(/\s+del\s+/g, ' de ');
    s = s.replace(/\uFFFD/g, '').replace(/\?/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    // Tras mojibake suele quedar "estratgica" / "estratgico" (falta la "e")
    s = s.replace(/estratgica\b/gi, 'estrategica');
    s = s.replace(/estratgico\b/gi, 'estrategico');
    s = s.replace(/estrat[^\s]+gica\b/gi, 'estrategica');
    s = s.replace(/estrat[^\s]+gico\b/gi, 'estrategico');
    return s;
}

function resolveTipo(
    tiposCache: { id: number; nombre: string }[],
    canonTipoNombre: string
): { id: number; nombre: string } | null {
    const key = tipoFoldKey(canonTipoNombre);
    const byKey = new Map(tiposCache.map((t) => [tipoFoldKey(t.nombre), t]));
    const direct = byKey.get(key);
    if (direct) return direct;

    const low = foldName(canonTipoNombre);
    if (low.includes('estrat') || canonTipoNombre.toLowerCase().includes('estrat')) {
        const hit = tiposCache.find((t) => /estrat/i.test(t.nombre) && /gico/i.test(t.nombre));
        if (hit) return hit;
    }
    if (low.includes('cumpli')) {
        return tiposCache.find((t) => /cumpl/i.test(t.nombre)) ?? null;
    }
    return null;
}

async function main() {
    if (!connectionString) {
        console.error('DATABASE_URL no está definida.');
        process.exit(1);
    }

    let updated = 0;
    let skippedHasDesc = 0;
    let skippedNoRow = 0;

    const tiposCache = await prisma.tipoRiesgo.findMany({ select: { id: true, nombre: true } });
    const allSubtipos = await prisma.subtipoRiesgo.findMany({
        select: { id: true, nombre: true, descripcion: true, tipoRiesgoId: true },
    });
    const subtiposByTipoId = new Map<number, typeof allSubtipos>();
    for (const s of allSubtipos) {
        const list = subtiposByTipoId.get(s.tipoRiesgoId) ?? [];
        list.push(s);
        subtiposByTipoId.set(s.tipoRiesgoId, list);
    }

    for (const p of PATCHES) {
        const tipo = resolveTipo(tiposCache, p.tipoNombre);
        if (!tipo) {
            console.warn(`[omitido] Tipo de riesgo no encontrado: "${p.tipoNombre}"`);
            skippedNoRow++;
            continue;
        }

        const want = subtipoCompareKey(p.subtipoNombre);
        let sub = (subtiposByTipoId.get(tipo.id) ?? []).find((s) => subtipoCompareKey(s.nombre) === want);

        if (!sub && p.subtipoNombre === 'Proyecto' && /estrat/i.test(tipo.nombre) && /gico/i.test(tipo.nombre)) {
            try {
                sub = await prisma.subtipoRiesgo.create({
                    data: {
                        tipoRiesgoId: tipo.id,
                        nombre: 'Proyecto',
                        descripcion: p.descripcion,
                    },
                });
                const list = subtiposByTipoId.get(tipo.id) ?? [];
                list.push(sub);
                subtiposByTipoId.set(tipo.id, list);
                console.log(`✓ Creado subtipo [${tipo.nombre}] Proyecto (faltaba en catálogo)`);
                updated++;
                continue;
            } catch (e: any) {
                console.warn('[omitido] No se pudo crear Proyecto (¿duplicado?):', e?.message || e);
                skippedNoRow++;
                continue;
            }
        }

        if (!sub) {
            console.warn(
                `[omitido] Subtipo no encontrado bajo "${tipo.nombre}": "${p.subtipoNombre}" (créelo en admin o ajuste el nombre)`
            );
            if (process.env.BACKFILL_DEBUG) {
                const subs = subtiposByTipoId.get(tipo.id) ?? [];
                console.warn(
                    '  compareKeys en BD:',
                    subs.map((s) => `${JSON.stringify(s.nombre)} → ${JSON.stringify(subtipoCompareKey(s.nombre))}`)
                );
                console.warn('  buscaba compareKey:', JSON.stringify(want));
            }
            skippedNoRow++;
            continue;
        }

        if (!isEmptyDescription(sub.descripcion)) {
            skippedHasDesc++;
            continue;
        }

        await prisma.subtipoRiesgo.update({
            where: { id: sub.id },
            data: { descripcion: p.descripcion },
        });
        console.log(`✓ Actualizado [${tipo.nombre}] ${sub.nombre}`);
        updated++;
    }

    console.log('\nResumen:');
    console.log(`  Actualizados: ${updated}`);
    console.log(`  Ya tenían descripción: ${skippedHasDesc}`);
    console.log(`  No encontrados / tipo faltante: ${skippedNoRow}`);
    console.log(
        '\nSi usas Redis para catálogos, vacía las claves catalogos:tipologias y catalogos:subtipos o espera el TTL.'
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
