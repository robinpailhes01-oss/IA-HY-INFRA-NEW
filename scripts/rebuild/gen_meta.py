#!/usr/bin/env python3
"""Génère lib/backup/schema-meta.ts depuis une base qui a reçu le SQL de
reconstruction : ordre de restauration (clés étrangères), clés primaires,
colonnes calculées.

    PGDB="psql -h /var/tmp -p 5544 -U postgres -d t1" python3 scripts/rebuild/gen_meta.py
"""
import json
import os
import subprocess

ROOT = __file__.rsplit("/scripts/", 1)[0]
psql = os.environ["PGDB"].split()
sql = r"""
with tabs as (select c.oid, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
fks as (select distinct conrelid::regclass::text as child, confrelid::regclass::text as parent from pg_constraint where contype='f' and connamespace='public'::regnamespace),
pks as (select conrelid::regclass::text as t, array_agg(a.attname order by x.n) as cols from pg_constraint k cross join lateral unnest(k.conkey) with ordinality x(attnum,n) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.attnum where k.contype='p' and k.connamespace='public'::regnamespace group by 1),
gens as (select attrelid::regclass::text as t, array_agg(attname) as cols from pg_attribute where attgenerated<>'' and attrelid in (select oid from tabs) group by 1),
selffk as (select conrelid::regclass::text as t, array_agg(a.attname) as cols from pg_constraint k join pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1] where k.contype='f' and k.conrelid=k.confrelid and k.connamespace='public'::regnamespace group by 1)
select json_build_object(
 'tables',(select json_agg(relname order by relname) from tabs),
 'fks',(select json_agg(json_build_array(replace(child,'public.',''),replace(parent,'public.',''))) from fks),
 'pks',(select json_object_agg(replace(t,'public.',''),cols) from pks),
 'generated',(select coalesce(json_object_agg(replace(t,'public.',''),cols),'{}') from gens),
 'selffk',(select coalesce(json_object_agg(replace(t,'public.',''),cols),'{}') from selffk));
"""
m = json.loads(subprocess.check_output(psql + ["-qtA", "-c", sql]))
tables = m["tables"]
deps = {t: set() for t in tables}
for c, p in m["fks"]:
    if c != p and p in tables:
        deps[c].add(p)
order, seen = [], set()
def visit(t):
    if t in seen:
        return
    seen.add(t)
    for d in sorted(deps[t]):
        visit(d)
    order.append(t)
for t in tables:
    visit(t)
pks = {t: m["pks"].get(t, []) for t in order}
out = f"""// Généré par scripts/rebuild/gen_meta.py — ne pas éditer à la main.
// Structure de la base reconstruite : ordre de restauration (une table après
// celles qu'elle référence), clés primaires, colonnes calculées.

export const RESTORE_ORDER = {json.dumps(order, indent=2)} as const;

/** Clé primaire de chaque table (pour l'upsert). */
export const PRIMARY_KEYS: Record<string, string[]> = {json.dumps(pks, indent=2)};

/** Colonnes calculées par la base : jamais envoyées à l'insertion. */
export const GENERATED_COLUMNS: Record<string, string[]> = {json.dumps(m["generated"], indent=2)};

/** Clés étrangères vers la même table : posées en second passage. */
export const SELF_REFERENCES: Record<string, string[]> = {json.dumps(m["selffk"], indent=2)};
"""
open(f"{ROOT}/lib/backup/schema-meta.ts", "w").write(out)
print(len(order), "tables")
