/**
 * Corrige mojibake en nombres de TipoRiesgo y SubtipoRiesgo (p. ej. Estrat?gico → Estratégico).
 *
 * Uso: npm run repair:tipologia-nombres-utf8
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

/** Normaliza secuencias rotas tipo estrat…gico / estrat…gica (solo si aplica; no tocar otros términos). */
function repairMojibakeEstratFragment(s: string): string {
    let x = s.normalize('NFC');
    if (!/estrat/i.test(x)) {
        return x;
    }
    x = x.replace(/\uFFFD/g, '');
    x = x.replace(/estrat\?gico/gi, 'estratégico');
    x = x.replace(/estrat\?gica/gi, 'estratégica');
    x = x.replace(/estratgico\b/gi, 'estratégico');
    x = x.replace(/estratgica\b/gi, 'estratégica');
    x = x.replace(/estrat[^\s]*gico\b/gi, 'estratégico');
    x = x.replace(/estrat[^\s]*gica\b/gi, 'estratégica');
    return x;
}

/** Corrige tokens que suelen quedar rotos por encoding en catálogos. */
function repairTokensFinancierosYOtros(s: string): string {
    return s
        .replace(/\bCr\?dito\b/gi, 'Crédito')
        .replace(/\bCrdito\b/gi, 'Crédito');
}

function repairTipoRiesgoNombre(nombre: string): string {
    const trimmed = nombre.trim();
    const m = trimmed.match(/^([\d.]+[\s.\-_]*)(.+)$/);
    const pref = m?.[1] ?? '';
    const restRaw = (m?.[2] ?? trimmed).trim();
    let rest = repairTokensFinancierosYOtros(repairMojibakeEstratFragment(restRaw));
    if (/^estratégico$/i.test(rest)) {
        rest = 'Estratégico';
    }
    const out = pref ? `${pref}${pref.endsWith(' ') ? '' : ' '}${rest}` : rest;
    return out.trim();
}

function repairSubtipoNombre(nombre: string): string {
    return repairTokensFinancierosYOtros(repairMojibakeEstratFragment(nombre.trim()));
}

async function main() {
    if (!connectionString) {
        console.error('DATABASE_URL no está definida.');
        process.exit(1);
    }

    let tipos = 0;
    let subtipos = 0;

    const allTipos = await prisma.tipoRiesgo.findMany({ select: { id: true, nombre: true } });
    for (const t of allTipos) {
        const fixed = repairTipoRiesgoNombre(t.nombre);
        if (fixed !== t.nombre) {
            try {
                await prisma.tipoRiesgo.update({
                    where: { id: t.id },
                    data: { nombre: fixed },
                });
                console.log(`✓ TipoRiesgo #${t.id}: ${JSON.stringify(t.nombre)} → ${JSON.stringify(fixed)}`);
                tipos++;
            } catch (e: any) {
                console.warn(`✗ TipoRiesgo #${t.id} no actualizado:`, e?.message || e);
            }
        }
    }

    const allSub = await prisma.subtipoRiesgo.findMany({ select: { id: true, nombre: true } });
    for (const s of allSub) {
        const fixed = repairSubtipoNombre(s.nombre);
        if (fixed !== s.nombre) {
            try {
                await prisma.subtipoRiesgo.update({
                    where: { id: s.id },
                    data: { nombre: fixed },
                });
                console.log(`✓ SubtipoRiesgo #${s.id}: ${JSON.stringify(s.nombre)} → ${JSON.stringify(fixed)}`);
                subtipos++;
            } catch (e: any) {
                console.warn(`✗ SubtipoRiesgo #${s.id} no actualizado:`, e?.message || e);
            }
        }
    }

    console.log(`\nListo. Tipos actualizados: ${tipos}, subtipos: ${subtipos}.`);
    console.log('Invalida caché Redis catalogos:tipologias / catalogos:subtipos si aplica.');
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
