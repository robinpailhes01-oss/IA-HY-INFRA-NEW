// Test de la logique de restauration avec une « base » simulée.
// Lancer : node --experimental-strip-types scripts/rebuild/test/restore.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// restore.ts utilise l'alias « @/ » de Next : on en fait une copie à import relatif.
const lib = join(dirname(fileURLToPath(import.meta.url)), "../../../lib/backup");
const tmp = mkdtempSync(join(tmpdir(), "restore-test-"));
copyFileSync(join(lib, "schema-meta.ts"), join(tmp, "schema-meta.ts"));
writeFileSync(join(tmp, "package.json"), '{"type":"module"}');
writeFileSync(join(tmp, "restore.ts"), readFileSync(join(lib, "restore.ts"), "utf8").replace('"@/lib/backup/schema-meta"', '"./schema-meta.ts"'));
const { restoreChunk, sanitize } = await import(pathToFileURL(join(tmp, "restore.ts")).href);

// Simule PostgREST : une colonne inconnue, une ligne invalide, une colonne calculée.
function fakeDb({ unknown = [], badIds = [] } = {}) {
  const stored = new Map();
  let calls = 0;
  const upsert = async (table, rows) => {
    calls++;
    for (const r of rows) {
      for (const c of Object.keys(r)) if (unknown.includes(c)) return { error: { message: `Could not find the '${c}' column of '${table}' in the schema cache`, code: "PGRST204" } };
      if ("net_margin" in r && table === "bookings") return { error: { message: 'cannot insert a non-DEFAULT value into column "net_margin"' } };
    }
    if (rows.some((r) => badIds.includes(r.id))) return { error: { message: "invalid input syntax" } };
    for (const r of rows) stored.set(r.id, r);
    return { error: null };
  };
  return { upsert, stored, calls: () => calls };
}

// 1. Colonne calculée retirée.
assert.deepEqual(sanitize("bookings", [{ id: "a", net_margin: 5, total_amount: 10 }]), [{ id: "a", total_amount: 10 }]);

// 2. Colonne inconnue : retirée, notée, tout le lot passe.
{
  const db = fakeDb({ unknown: ["ancienne_colonne"] });
  const rows = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, ancienne_colonne: "x", nom: "n" }));
  const res = await restoreChunk("leads", rows, db.upsert);
  assert.equal(res.ok, 50);
  assert.deepEqual(res.droppedColumns, ["ancienne_colonne"]);
  assert.equal(res.failed.length, 0);
  assert.ok(!("ancienne_colonne" in db.stored.get("r0")));
}

// 3. Une ligne mauvaise parmi 100 : les 99 autres sont restaurées, la fautive est identifiée.
{
  const db = fakeDb({ badIds: ["r37"] });
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: `r${i}` }));
  const res = await restoreChunk("customers", rows, db.upsert);
  assert.equal(res.ok, 99);
  assert.deepEqual(res.failed.map((f) => f.key), ["r37"]);
  assert.equal(db.stored.size, 99);
}

// 4. Passage « nullify » (clé étrangère vers la même table).
{
  const db = fakeDb();
  const res = await restoreChunk("customers", [{ id: "c1", referred_by: "c2" }, { id: "c2", referred_by: null }], db.upsert, { nullify: ["referred_by"] });
  assert.equal(res.ok, 2);
  assert.equal(db.stored.get("c1").referred_by, null);
}

// 5. Clé de conflit composite.
{
  const seen = [];
  await restoreChunk("hub_agent_channels", [{ agent_id: "a", channel_connection_id: "b" }], async (t, r, c) => { seen.push(c); return { error: null }; });
  assert.deepEqual(seen, ["agent_id,channel_connection_id"]);
}
console.log("restore.test.mjs : OK");
