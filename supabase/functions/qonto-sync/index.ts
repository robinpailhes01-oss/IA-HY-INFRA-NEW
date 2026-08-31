// Supabase Edge Function — Synchronisation bancaire Qonto
//
// Importe les comptes (avec leur solde réel) et les mouvements bancaires dans
// bank_accounts / bank_transactions. C'est la brique qui permet d'afficher une
// vraie trésorerie sur le dashboard, au lieu du résultat cumulé (revenus saisis
// − dépenses saisies) qui dérivait de la réalité dès qu'une sortie d'argent
// n'était pas enregistrée à la main.
//
// Cette fonction ne fait QUE lire et stocker. Elle ne crée aucune dépense et ne
// touche pas à l'historique existant — le rapprochement est une étape séparée.
//
// Secrets attendus (Supabase → Edge Functions → Secrets) :
//   QONTO_API_KEY   au format "login:secret_key" (Qonto → Intégrations et
//                   partenariats → Clé API). Cette clé donne accès aux données
//                   bancaires : elle ne doit vivre que dans les secrets
//                   Supabase, jamais dans le repo ni côté navigateur.
//   CRON_SECRET     partagé avec les autres jobs planifiés (header x-cron-secret)
//   QONTO_SYNC_FROM (optionnel) date ISO de départ du premier import,
//                   par défaut le 1er janvier de l'année en cours.
//
// Appel manuel :
//   curl -X POST https://<ref>.supabase.co/functions/v1/qonto-sync \
//        -H "x-cron-secret: <CRON_SECRET>" -H "content-type: application/json" -d '{}'

import { createClient } from "npm:@supabase/supabase-js@2";

const QONTO_API_KEY = Deno.env.get("QONTO_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const QONTO_BASE = "https://thirdparty.qonto.com/v2";
const PER_PAGE = 100;
// Garde-fou : au-delà, on s'arrête et on reprendra au prochain passage plutôt
// que de risquer un timeout de la fonction sur un très gros historique.
const MAX_PAGES_PER_ACCOUNT = 50;
// On repart légèrement avant le dernier import pour absorber les décalages
// d'horloge et les écritures concurrentes côté Qonto.
const OVERLAP_MINUTES = 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type QontoBankAccount = {
  id: string;
  name?: string | null;
  iban?: string | null;
  currency?: string | null;
  balance_cents?: number | null;
  authorized_balance_cents?: number | null;
  main?: boolean | null;
  status?: string | null;
  updated_at?: string | null;
};

type QontoTransaction = {
  id: string;
  bank_account_id?: string | null;
  side: string;
  amount_cents?: number | null;
  currency?: string | null;
  status: string;
  operation_type?: string | null;
  label?: string | null;
  clean_counterparty_name?: string | null;
  reference?: string | null;
  note?: string | null;
  category?: string | null;
  cashflow_category?: { name?: string | null } | string | null;
  settled_at?: string | null;
  emitted_at?: string | null;
  updated_at?: string | null;
};

async function qontoGet(path: string, params: Record<string, string | string[]>): Promise<any> {
  const url = new URL(`${QONTO_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      // Qonto attend les filtres répétés sous la forme status[]=a&status[]=b
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    headers: {
      // Format Qonto : "login:secret_key" en clair, ce n'est pas du Basic auth.
      Authorization: QONTO_API_KEY,
      "content-type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Qonto ${path} → ${res.status} ${body.slice(0, 300)}`);
  }
  return await res.json();
}

// Qonto renvoie soit un objet cashflow_category, soit rien. On n'en garde que
// le nom lisible — la taxonomie est propre à chaque organisation.
function cashflowCategoryName(value: QontoTransaction["cashflow_category"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.name ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!QONTO_API_KEY) {
    return json({ error: "QONTO_API_KEY manquant — à ajouter dans les secrets Supabase" }, 500);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const runStartedAt = new Date();

  try {
    const { data: state } = await supabase
      .from("qonto_sync_state")
      .select("last_synced_at")
      .eq("id", true)
      .maybeSingle();

    const fallbackFrom = Deno.env.get("QONTO_SYNC_FROM") ?? `${runStartedAt.getUTCFullYear()}-01-01T00:00:00Z`;
    const updatedAtFrom = state?.last_synced_at
      ? new Date(new Date(state.last_synced_at).getTime() - OVERLAP_MINUTES * 60_000).toISOString()
      : new Date(fallbackFrom).toISOString();

    // 1. Comptes + soldes réels (un seul appel renvoie l'organisation et ses comptes).
    const org = await qontoGet("/organization", {});
    const accounts: QontoBankAccount[] = org?.organization?.bank_accounts ?? [];

    if (accounts.length > 0) {
      const { error } = await supabase.from("bank_accounts").upsert(
        accounts.map((a) => ({
          id: a.id,
          name: a.name ?? null,
          iban: a.iban ?? null,
          currency: a.currency ?? "EUR",
          balance_cents: a.balance_cents ?? 0,
          authorized_balance_cents: a.authorized_balance_cents ?? 0,
          is_main: a.main ?? false,
          status: a.status ?? null,
          balance_updated_at: a.updated_at ?? runStartedAt.toISOString(),
          updated_at: runStartedAt.toISOString(),
        })),
        { onConflict: "id" },
      );
      if (error) throw new Error(`upsert bank_accounts: ${error.message}`);
    }

    // 2. Mouvements, compte par compte, page par page.
    let synced = 0;
    let truncated = false;

    for (const account of accounts) {
      if (account.status === "closed") continue;

      for (let page = 1; page <= MAX_PAGES_PER_ACCOUNT; page++) {
        const payload = await qontoGet("/transactions", {
          bank_account_id: account.id,
          // Par défaut Qonto ne renvoie que 'completed' — on veut aussi voir
          // les opérations engagées mais pas encore réglées.
          "status[]": ["completed", "pending"],
          updated_at_from: updatedAtFrom,
          per_page: String(PER_PAGE),
          page: String(page),
          sort_by: "updated_at:asc",
        });

        const transactions: QontoTransaction[] = payload?.transactions ?? [];
        if (transactions.length === 0) break;

        const { error } = await supabase.from("bank_transactions").upsert(
          transactions.map((t) => ({
            qonto_id: t.id,
            bank_account_id: t.bank_account_id ?? account.id,
            side: t.side,
            amount_cents: Math.abs(t.amount_cents ?? 0),
            currency: t.currency ?? "EUR",
            status: t.status,
            operation_type: t.operation_type ?? null,
            label: t.label ?? null,
            counterparty_name: t.clean_counterparty_name ?? null,
            reference: t.reference ?? null,
            note: t.note ?? null,
            qonto_category: t.category ?? null,
            cashflow_category: cashflowCategoryName(t.cashflow_category),
            settled_at: t.settled_at ?? null,
            emitted_at: t.emitted_at ?? null,
            qonto_updated_at: t.updated_at ?? null,
            raw: t,
            updated_at: runStartedAt.toISOString(),
          })),
          { onConflict: "qonto_id" },
        );
        if (error) throw new Error(`upsert bank_transactions: ${error.message}`);

        synced += transactions.length;

        const nextPage = payload?.meta?.next_page ?? null;
        if (!nextPage) break;
        if (page === MAX_PAGES_PER_ACCOUNT) truncated = true;
      }
    }

    // Si on s'est arrêté sur le garde-fou, on ne fait pas avancer le curseur :
    // le prochain passage doit reprendre là où on en était, pas sauter le reste.
    await supabase
      .from("qonto_sync_state")
      .update({
        last_synced_at: truncated ? (state?.last_synced_at ?? null) : runStartedAt.toISOString(),
        last_run_at: runStartedAt.toISOString(),
        last_error: null,
        transactions_synced: synced,
      })
      .eq("id", true);

    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance_cents ?? 0), 0);
    console.log(`qonto-sync: ${synced} mouvements, ${accounts.length} compte(s), solde ${totalBalance / 100} €`);

    return json({
      ok: true,
      accounts: accounts.length,
      transactions_synced: synced,
      balance_eur: totalBalance / 100,
      truncated,
      since: updatedAtFrom,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("qonto-sync error", message);
    await supabase
      .from("qonto_sync_state")
      .update({ last_run_at: runStartedAt.toISOString(), last_error: message })
      .eq("id", true);
    return json({ error: message }, 500);
  }
});
