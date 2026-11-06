// Logique PURE de restauration (aucun accès réseau ici : l'écriture est
// injectée). Testable seule — voir scripts/rebuild/test/restore.test.mjs.
//
// Ce que ça gère, parce que ça arrive vraiment :
//   · une colonne présente dans l'ancienne base mais absente de la
//     reconstruction → PostgREST répond « Could not find the 'x' column » ;
//     on retire la colonne (et on la note) plutôt que d'abandonner la table ;
//   · une ligne qui échoue (valeur invalide…) ne doit pas faire perdre les
//     199 autres : on coupe le lot en deux jusqu'à isoler la ligne fautive ;
//   · une colonne calculée par la base ne s'insère pas.

import { GENERATED_COLUMNS, PRIMARY_KEYS } from "@/lib/backup/schema-meta";

export type Row = Record<string, unknown>;
export type WriteError = { message: string; code?: string | null } | null;
export type UpsertFn = (table: string, rows: Row[], onConflict: string) => Promise<{ error: WriteError }>;

export type ChunkResult = {
  ok: number;
  failed: Array<{ key: string; error: string }>;
  droppedColumns: string[];
};

const MISSING_COLUMN = /Could not find the '([^']+)' column/i;

export function conflictTarget(table: string): string {
  const pk = PRIMARY_KEYS[table];
  return pk && pk.length > 0 ? pk.join(",") : "id";
}

function rowKey(table: string, row: Row): string {
  const pk = PRIMARY_KEYS[table];
  const cols = pk && pk.length > 0 ? pk : ["id"];
  return cols.map((c) => String(row[c] ?? "?")).join("|");
}

export function sanitize(table: string, rows: Row[], nullify: string[] = []): Row[] {
  const generated = new Set(GENERATED_COLUMNS[table] ?? []);
  return rows.map((r) => {
    const copy: Row = {};
    for (const [k, v] of Object.entries(r)) if (!generated.has(k)) copy[k] = v;
    for (const c of nullify) if (c in copy) copy[c] = null;
    return copy;
  });
}

export async function restoreChunk(
  table: string,
  input: Row[],
  upsert: UpsertFn,
  options: { nullify?: string[] } = {},
): Promise<ChunkResult> {
  let rows = sanitize(table, input, options.nullify);
  const droppedColumns: string[] = [];
  const onConflict = conflictTarget(table);
  const failed: ChunkResult["failed"] = [];
  let ok = 0;

  async function attempt(batch: Row[], depth = 0): Promise<void> {
    if (batch.length === 0) return;
    const { error } = await upsert(table, batch, onConflict);
    if (!error) {
      ok += batch.length;
      return;
    }
    const missing = MISSING_COLUMN.exec(error.message)?.[1];
    if (missing && depth < 40) {
      droppedColumns.push(missing);
      rows = rows.map((r) => {
        const { [missing]: _drop, ...rest } = r;
        void _drop;
        return rest;
      });
      // On repart du lot entier sans la colonne.
      const cleaned = batch.map((r) => {
        const { [missing]: _drop, ...rest } = r;
        void _drop;
        return rest;
      });
      return attempt(cleaned, depth + 1);
    }
    if (batch.length === 1) {
      failed.push({ key: rowKey(table, batch[0]), error: error.message });
      return;
    }
    const mid = Math.ceil(batch.length / 2);
    await attempt(batch.slice(0, mid), depth + 1);
    await attempt(batch.slice(mid), depth + 1);
  }

  await attempt(rows);
  return { ok, failed, droppedColumns: [...new Set(droppedColumns)] };
}

/** Compare ce qu'on voulait restaurer et ce qui y est. */
export function summarize(expected: number, result: { ok: number; failed: unknown[] }) {
  return { expected, restored: result.ok, failed: result.failed.length, complete: result.ok === expected && result.failed.length === 0 };
}
