import type { PrismaClient } from '@prisma/client';
import { fullTextSanitize } from '../../src/utils/normalizeTextoUi';

export type ScanHit = {
  table: string;
  column: string;
  pk: Record<string, unknown>;
  preview: string;
};

type ApplyMutation = {
  table: string;
  column: string;
  pks: string[];
  row: Record<string, unknown>;
  next: string;
};

type ColRow = { table_name: string; column_name: string; data_type: string };

function assertSafeIdent(name: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Identificador no permitido en escaneo BD: ${name}`);
  }
}

function q(name: string): string {
  assertSafeIdent(name);
  return `"${name}"`;
}

const PROBLEMATIC_CODEPOINTS = [171, 187, 8220, 8221, 8216, 8217, 8203, 8206, 8207, 65279, 160];

function sqlMayContainProblematicChars(colQuoted: string): string {
  const parts = PROBLEMATIC_CODEPOINTS.map((cp) => `strpos(${colQuoted}, chr(${cp})) > 0`);
  const spanish = `strpos(${colQuoted}, 'Estrat?gico') > 0 OR strpos(${colQuoted}, 'Estrat' || CHR(65533) || 'gico') > 0 OR ${colQuoted} ~* '\\yEstratgico\\y'`;
  const mojibakeOrBroken = `strpos(${colQuoted}, CHR(65533)) > 0 OR strpos(${colQuoted}, CHR(195)) > 0 OR strpos(${colQuoted}, CHR(194)) > 0 OR strpos(${colQuoted}, 'Comit?') > 0 OR strpos(${colQuoted}, 'Comite ') > 0 OR strpos(${colQuoted}, 'los establecido') > 0`;
  return `(${parts.join(' OR ')} OR ${spanish} OR ${mojibakeOrBroken})`;
}

const SKIP_COLUMNS = new Set(
  [
    'password',
    'twoFactorSecret',
    'fotoPerfil',
    'documentoUrl',
    'documentoCaracterizacionUrl',
    'documentoFlujoGramaUrl',
    'residualmodo',
  ].map((s) => s.toLowerCase())
);

function shouldSkipColumn(table: string, column: string): boolean {
  const c = column.toLowerCase();
  if (SKIP_COLUMNS.has(c)) return true;
  if (c.endsWith('url') || c.endsWith('uri')) return true;
  if (c.includes('password')) return true;
  if (c === 'twofactorsecret') return true;
  if (c.includes('documento') && c.endsWith('nombre')) return true;
  void table;
  return false;
}

export async function loadTextColumns(prisma: PrismaClient): Promise<ColRow[]> {
  const rows = await prisma.$queryRaw<ColRow[]>`
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> '_prisma_migrations'
      AND c.data_type IN ('text', 'character varying', 'character')
    ORDER BY c.table_name, c.column_name
  `;
  return rows;
}

export async function loadPrimaryKeyColumns(
  prisma: PrismaClient,
  tableName: string
): Promise<string[]> {
  assertSafeIdent(tableName);
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ${tableName}
    ORDER BY kcu.ordinal_position
  `;
  return rows.map((r) => r.column_name);
}

async function scanOneColumnFull(
  prisma: PrismaClient,
  table: string,
  column: string,
  pks: string[],
  limit: number
): Promise<{ hits: ScanHit[]; mutations: ApplyMutation[]; scanned: number }> {
  const colQ = q(column);
  const selectList = [...pks.map((c) => q(c)), `${colQ} AS "_tval"`].join(', ');
  const pre = sqlMayContainProblematicChars(colQ);
  const sql = `SELECT ${selectList} FROM ${q(table)} WHERE ${colQ} IS NOT NULL AND ${pre} LIMIT ${limit}`;
  const rows = (await prisma.$queryRawUnsafe(sql)) as Record<string, unknown>[];
  const hits: ScanHit[] = [];
  const mutations: ApplyMutation[] = [];
  let scanned = 0;
  for (const row of rows) {
    scanned += 1;
    const raw = row._tval;
    if (typeof raw !== 'string') continue;
    const next = fullTextSanitize(raw);
    if (next === raw) continue;
    const pk: Record<string, unknown> = {};
    for (const pkc of pks) pk[pkc] = row[pkc];
    const preview = raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
    hits.push({ table, column, pk, preview });
    mutations.push({ table, column, pks, row, next });
  }
  return { hits, mutations, scanned };
}

const COLUMN_SCAN_CONCURRENCY = 8;

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      out[idx] = await fn(items[idx]);
    }
  };
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function collectTextColumnsAndScan(
  prisma: PrismaClient,
  opts: { limitRowsPerColumn?: number } = {}
): Promise<ScanHit[]> {
  const limit = opts.limitRowsPerColumn ?? 50_000;
  const cols = await loadTextColumns(prisma);
  const pkCache = new Map<string, string[]>();

  const tasks: { table: string; column: string; pks: string[] }[] = [];
  for (const { table_name: table, column_name: column } of cols) {
    if (shouldSkipColumn(table, column)) continue;
    let pks = pkCache.get(table);
    if (pks === undefined) {
      pks = await loadPrimaryKeyColumns(prisma, table);
      pkCache.set(table, pks);
    }
    if (!pks.length) continue;
    tasks.push({ table, column, pks });
  }

  const chunkResults = await mapPool(tasks, COLUMN_SCAN_CONCURRENCY, (t) =>
    scanOneColumnFull(prisma, t.table, t.column, t.pks, limit)
  );
  return chunkResults.flatMap((r) => r.hits);
}

export async function applyTextNormalization(
  prisma: PrismaClient,
  opts: { limitRowsPerColumn?: number; dryRun?: boolean } = {}
): Promise<{ scannedCells: number; updatedCells: number; hitsBefore: ScanHit[] }> {
  const limit = opts.limitRowsPerColumn ?? 50_000;
  const dryRun = opts.dryRun !== false;
  const cols = await loadTextColumns(prisma);
  const pkCache = new Map<string, string[]>();

  const tasks: { table: string; column: string; pks: string[] }[] = [];
  for (const { table_name: table, column_name: column } of cols) {
    if (shouldSkipColumn(table, column)) continue;
    let pks = pkCache.get(table);
    if (pks === undefined) {
      pks = await loadPrimaryKeyColumns(prisma, table);
      pkCache.set(table, pks);
    }
    if (!pks.length) continue;
    tasks.push({ table, column, pks });
  }

  const chunkResults = await mapPool(tasks, COLUMN_SCAN_CONCURRENCY, (t) =>
    scanOneColumnFull(prisma, t.table, t.column, t.pks, limit)
  );

  let scannedCells = 0;
  const hitsBefore: ScanHit[] = [];
  const mutations: ApplyMutation[] = [];
  for (const r of chunkResults) {
    scannedCells += r.scanned;
    hitsBefore.push(...r.hits);
    mutations.push(...r.mutations);
  }

  let updatedCells = 0;
  if (!dryRun && mutations.length) {
    await mapPool(mutations, COLUMN_SCAN_CONCURRENCY, async (m) => {
      const whereParts = m.pks.map((pkc, i) => `${q(pkc)} = $${i + 2}`).join(' AND ');
      const params: unknown[] = [m.next, ...m.pks.map((pkc) => m.row[pkc])];
      const updateSql = `UPDATE ${q(m.table)} SET ${q(m.column)} = $1 WHERE ${whereParts}`;
      await prisma.$executeRawUnsafe(updateSql, ...params);
    });
    updatedCells = mutations.length;
  }

  return { scannedCells, updatedCells, hitsBefore };
}
