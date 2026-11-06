#!/usr/bin/env python3
"""Reconstruit le schéma des tables « de base » (celles qui ne sont créées par
aucune migration) à partir des types générés du projet (types/database.ts).

Pourquoi : le projet Supabase d'origine n'est plus accessible et ces tables
n'existent dans aucun fichier SQL du dépôt. Les types donnent les colonnes, leur
nullabilité, si elles ont une valeur par défaut (champ optionnel à l'insertion)
et les clés étrangères — pas les types SQL exacts ni les contraintes : ils sont
devinés par nom de colonne (voir TYPE_RULES) et vérifiés ensuite contre le
schéma réel publié par PostgREST (schema/openapi.json de la sauvegarde).

Aucune contrainte CHECK n'est recréée : on préfère accepter toute donnée
historique que la refuser.

Usage : python3 scripts/rebuild/gen_base_schema.py > supabase/rebuild/01_base_schema.sql
"""
import glob
import json
import re
import sys

ROOT = __file__.rsplit("/scripts/", 1)[0]
types = open(f"{ROOT}/types/database.ts").read()

tables_sec = types[types.index("    Tables: {"): types.index("    Views: {")]
blocks = re.split(r"\n      ([a-z_]+): \{\n        Row: \{", tables_sec)
names, bodies = blocks[1::2], blocks[2::2]

migration_sql = "".join(open(f).read().lower() for f in sorted(glob.glob(f"{ROOT}/supabase/migrations/*.sql")))
created_by_migrations = set(re.findall(r"create table(?: if not exists)? +(?:public\.)?([a-z_]+)", migration_sql))
base = [n for n in names if n not in created_by_migrations]

# Colonnes AJOUTÉES par les migrations (alter table … add column) : on ne les met
# pas dans les tables de base, sinon la migration échouerait (« already exists »)
# et on perdrait sa définition exacte (défaut, clé étrangère…).
added_by_migrations = {}
for stmt in re.split(r";\s*\n", re.sub(r"--[^\n]*", "", "\n".join(open(f).read() for f in sorted(glob.glob(f"{ROOT}/supabase/migrations/*.sql"))))):
    m = re.match(r"\s*alter table\s+(?:only\s+)?(?:if exists\s+)?(?:public\.)?([a-z_]+)\s+(.*)$", stmt, re.I | re.S)
    if not m:
        continue
    for c in re.findall(r"add column(?:\s+if not exists)?\s+([a-z_0-9]+)", m.group(2), re.I):
        added_by_migrations.setdefault(m.group(1).lower(), set()).add(c.lower())

enum_sec = types[types.index("    Enums: {"): types.index("    CompositeTypes")]
enums = {}
for m in re.finditer(r"\n      ([a-z_]+):\n((?:        \| \"[^\"]+\"\n?)+)", enum_sec):
    enums[m.group(1)] = re.findall(r'"([^"]+)"', m.group(2))

# ── Types SQL devinés ───────────────────────────────────────────────────────
INTEGER = re.compile(
    r"^(party_size|score|followup_count|bookings_count|member_number|max_participants|current_bookings|"
    r"unread_count|message_count|tokens_input|tokens_output|max_followups|likes|views|clicks|impressions|"
    r"shares|comments|leads_generated|leads_attributed|bookings_attributed|nb_panneaux_recommande)$"
)
TIMESTAMP = re.compile(r"(_at|_until)$")
DATE = {"date", "desired_date", "balance_due_date", "period_start", "period_end", "publish_date", "birthday", "date_photo_satellite"}
TIME = {"start_time", "end_time", "publish_time"}
TEXT_ID = {"hermes_agent_id", "proposition_id", "stripe_session_id", "google_calendar_event_id", "sumup_transaction_id", "wa_message_id", "created_by", "assigned_to", "referral_code", "member_page_slug"}

# Tables dont la colonne `id` n'est pas un uuid généré.
TEXT_PK = {"wa_auth_state"}

# Colonnes calculées par la base (jamais insérées).
GENERATED = {
    "bookings": {"net_margin": "coalesce(total_amount, 0) - coalesce(costs, 0)"},
}

# Valeurs par défaut connues (lues dans le code et le seed).
DEFAULTS = {
    ("leads", "status"): "'new'",
    ("leads", "score"): "0",
    ("leads", "archived"): "false",
    ("leads", "followup_count"): "0",
    ("leads", "needs_human_intervention"): "false",
    ("customers", "tier"): "'membre'",
    ("customers", "total_spent"): "0",
    ("customers", "bookings_count"): "0",
    ("customers", "member_card_issued"): "false",
    ("bookings", "status"): "'pending'",
    ("bookings", "deposit_paid"): "false",
    ("bookings", "reminder_sent"): "false",
    ("bookings", "review_requested"): "false",
    ("bookings", "review_received"): "false",
    ("bookings", "balance_payments"): "'[]'::jsonb",
    ("bookings", "is_gift_card"): "false",
    ("events_public", "status"): "'published'",
    ("events_public", "current_bookings"): "0",
    ("events_public", "total_revenue"): "0",
    ("event_bookings", "party_size"): "1",
    ("event_bookings", "payment_status"): "'pending'",
    ("wa_conversations", "is_paused"): "false",
    ("wa_conversations", "unread_count"): "0",
    ("wa_messages", "from_me"): "false",
    ("wa_messages", "is_from_human"): "false",
    ("agent_config", "auto_followup_enabled"): "true",
    ("agent_config", "max_followups"): "2",
}


def sql_type(table: str, col: str, ts_type: str, fk_target: str | None) -> str:
    t = ts_type.replace(" | null", "").strip()
    if col == "id":
        return "text" if table in TEXT_PK else "uuid"
    if fk_target:
        return "uuid"
    if "Enums" in t:
        return re.search(r'Enums"\]\["([a-z_]+)"', t).group(1)
    if t == "Json":
        return "jsonb"
    if t == "string[]":
        return "text[]"
    if t == "boolean":
        return "boolean"
    if t == "number":
        return "integer" if INTEGER.match(col) else "numeric"
    # t == "string"
    if col in TEXT_ID:
        return "text"
    if TIMESTAMP.search(col):
        return "timestamptz"
    if col in DATE:
        return "date"
    if col in TIME:
        return "time"
    return "text"


def json_default(col: str) -> str:
    return "'[]'::jsonb" if col in {"balance_payments", "messages", "attachments"} else "'{}'::jsonb"


def fallback_default(sql_t: str, col: str) -> str | None:
    if sql_t == "timestamptz":
        return "now()"
    if sql_t == "boolean":
        return "false"
    if sql_t == "jsonb":
        return json_default(col)
    if sql_t == "text[]":
        return "'{}'"
    if sql_t in ("integer", "numeric"):
        return "0"
    if sql_t == "text":
        return "''"
    return None


out = []
p = out.append
p("-- ═══════════════════════════════════════════════════════════════════════")
p("-- Schéma des tables de base — RECONSTITUÉ depuis les types générés.")
p("-- Généré par scripts/rebuild/gen_base_schema.py : ne pas éditer à la main.")
p("-- Les types SQL sont devinés ; à comparer au schéma réel (openapi.json).")
p("-- ═══════════════════════════════════════════════════════════════════════")
p("")
for name, values in enums.items():
    vals = ", ".join(f"'{v}'" for v in values)
    p(f"do $$ begin create type public.{name} as enum ({vals}); exception when duplicate_object then null; end $$;")
p("")

# Ordre : tables sans dépendance d'abord (tri topologique sur les FK).
meta = {}
for n, b in zip(names, bodies):
    if n not in base:
        continue
    row = b.split("        Insert: {")[0]
    ins = b.split("        Insert: {")[1].split("        Update: {")[0]
    cols = [c for c in re.findall(r"^          ([a-z_0-9]+)(\?)?: (.+)$", row, re.M) if c[0] not in added_by_migrations.get(n, set())]
    optional = {c for c, o, _ in re.findall(r"^          ([a-z_0-9]+)(\?)?: (.+)$", ins, re.M) if o}
    rels = re.findall(
        r'columns: \["([a-z_0-9]+)"\]\s+isOneToOne: (?:true|false)\s+referencedRelation: "([a-z_]+)"\s+referencedColumns: \["([a-z_0-9]+)"\]', b
    )
    meta[n] = {"cols": cols, "optional": optional, "rels": {c: (t, rc) for c, t, rc in rels}}

order, seen = [], set()


def visit(n):
    if n in seen:
        return
    seen.add(n)
    for c, (t, _) in meta[n]["rels"].items():
        if t in meta and t != n:
            visit(t)
    order.append(n)


for n in meta:
    visit(n)

deferred_fk = []
for n in order:
    m = meta[n]
    p(f"create table if not exists public.{n} (")
    lines = []
    for col, opt, ts in m["cols"]:
        nullable = "null" in ts
        fk = m["rels"].get(col)
        fk_target = fk[0] if fk else None
        st = sql_type(n, col, ts, fk_target)
        gen = GENERATED.get(n, {}).get(col)
        if gen:
            lines.append(f"  {col} numeric generated always as ({gen}) stored")
            continue
        parts = [f"  {col} {st}"]
        if col == "id":
            parts.append("primary key")
            if st == "uuid" and col in m["optional"]:
                parts.append("default gen_random_uuid()")
        else:
            if not nullable:
                parts.append("not null")
            dflt = DEFAULTS.get((n, col))
            if dflt is None and st == "timestamptz" and col in {"created_at", "updated_at", "fetched_at", "sent_at", "occurred_at"}:
                dflt = "now()"
            if dflt is None and col in m["optional"] and not nullable:
                dflt = fallback_default(st, col)
            if dflt is not None:
                parts.append(f"default {dflt}")
        lines.append(" ".join(parts))
        if fk and fk_target and fk_target != "profiles":
            # Clé étrangère : posée après coup pour tolérer l'auto-référence (customers.referred_by).
            deferred_fk.append((n, col, fk_target, fk[1]))
    if n == "customers":
        lines = [l for l in lines]
    p(",\n".join(lines))
    p(");")
    p("")

# member_number : séquence propre (un numéro de membre croissant).
p("create sequence if not exists public.customers_member_number_seq;")
p("alter table public.customers alter column member_number set default nextval('public.customers_member_number_seq');")
p("")
p("-- Clés étrangères (après création de toutes les tables).")
for n, col, t, rc in deferred_fk:
    on = "on delete set null" if not any(c == col and "null" not in ts for c, _, ts in meta[n]["cols"]) else "on delete cascade"
    p(f"do $$ begin alter table public.{n} add constraint {n}_{col}_fkey foreign key ({col}) references public.{t} ({rc}) {on}; exception when duplicate_object then null; end $$;")
p("")
p("-- profiles.id = identifiant du compte de connexion (auth.users).")
p("do $$ begin alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade; exception when duplicate_object then null; end $$;")
p("")
p("-- hub_agent_channels : table de liaison, clé composite.")
p("do $$ begin alter table public.hub_agent_channels add primary key (agent_id, channel_connection_id); exception when others then null; end $$;")
p("")
p("-- Unicité exigée par le code (upsert … onConflict).")
p("create unique index if not exists wa_conversations_customer_phone_key on public.wa_conversations (customer_phone);")
p("create unique index if not exists customers_member_number_key on public.customers (member_number);")
p("")
sys.stdout.write("\n".join(out) + "\n")
print(f"-- {len(order)} tables : {', '.join(order)}", file=sys.stderr)
