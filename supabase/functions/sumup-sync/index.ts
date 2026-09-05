// Supabase Edge Function — Synchronisation SumUp
//
// Importe les ventes encaissées au terminal (et leurs commissions) ainsi que
// les virements SumUp vers la banque. C'est le flux qui manquait : la moitié du
// chiffre d'affaires est réglée le jour de la sortie, et n'existait nulle part
// dans le système.
//
// Deux contraintes de l'API SumUp qui dictent la forme de cette fonction :
//
//  1. La liste des transactions ne contient AUCUNE commission. Il faut un appel
//     de détail par vente pour obtenir fee_amount. On plafonne donc le nombre
//     d'appels de détail par passage, et on ne les refait jamais deux fois
//     (detail_fetched_at).
//  2. Aucun webhook n'existe pour les transactions ni les virements — seuls les
//     lecteurs et les membres en émettent. La synchro est donc forcément par
//     interrogation périodique, avec `changes_since` comme curseur : il ramène
//     aussi les remboursements et impayés survenus après coup.
//
// Secrets attendus (Supabase → Edge Functions → Secrets) :
//   SUMUP_API_KEY        clé API (me.sumup.com → Settings → For Developers →
//                        API Keys). Affichée une seule fois à la création.
//   SUMUP_MERCHANT_CODE  code marchand (ex. MK10CL2A), visible dans le profil.
//   CRON_SECRET          partagé avec les autres jobs planifiés
//   SUMUP_SYNC_FROM      (optionnel) date ISO de départ du premier import

import { createClient } from "npm:@supabase/supabase-js@2";

const SUMUP_API_KEY = Deno.env.get("SUMUP_API_KEY") ?? "";
const SUMUP_MERCHANT_CODE = Deno.env.get("SUMUP_MERCHANT_CODE") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SUMUP_BASE = "https://api.sumup.com";

// La liste renvoie 10 éléments par défaut si on ne précise rien — piège
// silencieux, on force toujours une valeur.
const PAGE_LIMIT = 100;
const MAX_PAGES = 30;
// Plafond d'appels de détail par passage : c'est du N+1, on étale sur
// plusieurs exécutions plutôt que de risquer un timeout.
const MAX_DETAIL_CALLS = 150;
const OVERLAP_MINUTES = 60;
const DAY_MS = 86_400_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type SumUpTransaction = {
  id: string;
  transaction_code?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  type?: string | null;
  payment_type?: string | null;
  card_type?: string | null;
  entry_mode?: string | null;
  fee_amount?: number | null;
  vat_amount?: number | null;
  tip_amount?: number | null;
  refunded_amount?: number | null;
  timestamp?: string | null;
  payout_date?: string | null;
  payout_type?: string | null;
};

type SumUpPayout = {
  id: number;
  type: string;
  amount?: number | null;
  fee?: number | null;
  currency?: string | null;
  date: string;
  status?: string | null;
  reference?: string | null;
  transaction_code?: string | null;
};

async function sumupGet(path: string): Promise<any> {
  const res = await fetch(`${SUMUP_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${SUMUP_API_KEY}`,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SumUp ${path.split("?")[0]} → ${res.status} ${body.slice(0, 300)}`);
  }
  return await res.json();
}

// Les montants arrivent en flottants (unités majeures). On arrondit au centime
// avant de les confier à Postgres : la colonne est numeric, on ne veut pas y
// injecter d'artefact de représentation binaire.
const money = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : Math.round(v * 100) / 100;

function mapTransaction(t: SumUpTransaction) {
  return {
    id: t.id,
    transaction_code: t.transaction_code ?? null,
    amount: money(t.amount) ?? 0,
    currency: t.currency ?? "EUR",
    status: t.status ?? null,
    type: t.type ?? null,
    payment_type: t.payment_type ?? null,
    card_type: t.card_type ?? null,
    entry_mode: t.entry_mode ?? null,
    occurred_at: t.timestamp ?? null,
    payout_date: t.payout_date ?? null,
    payout_type: t.payout_type ?? null,
    refunded_amount: money(t.refunded_amount),
    raw: t,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
    return json({ error: "SUMUP_API_KEY ou SUMUP_MERCHANT_CODE manquant dans les secrets Supabase" }, 500);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const runStartedAt = new Date();
  const merchant = encodeURIComponent(SUMUP_MERCHANT_CODE);

  try {
    const { data: state } = await supabase
      .from("sumup_sync_state")
      .select("last_synced_at, last_payout_date")
      .eq("id", true)
      .maybeSingle();

    const fallbackFrom = Deno.env.get("SUMUP_SYNC_FROM") ?? `${runStartedAt.getUTCFullYear()}-01-01T00:00:00Z`;
    const changesSince = state?.last_synced_at
      ? new Date(new Date(state.last_synced_at).getTime() - OVERLAP_MINUTES * 60_000).toISOString()
      : new Date(fallbackFrom).toISOString();

    // ── 1. Ventes ────────────────────────────────────────────────────────────
    let path =
      `/v2.1/merchants/${merchant}/transactions/history` +
      `?limit=${PAGE_LIMIT}&order=ascending&changes_since=${encodeURIComponent(changesSince)}`;
    let syncedTx = 0;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const payload = await sumupGet(path);
      const items: SumUpTransaction[] = payload?.items ?? [];

      if (items.length > 0) {
        const { error } = await supabase
          .from("sumup_transactions")
          .upsert(items.map(mapTransaction), { onConflict: "id" });
        if (error) throw new Error(`upsert sumup_transactions: ${error.message}`);
        syncedTx += items.length;
      }

      // Pagination par curseur : le lien "next" est un fragment de query string
      // brut (ex. "limit=100&oldest_ref=…"), pas une URL absolue — on le
      // recolle nous-mêmes derrière le chemin de l'endpoint.
      const next = (payload?.links ?? []).find((l: { rel?: string }) => l?.rel === "next");
      const href: string | undefined = next?.href;
      if (!href || items.length === 0) break;
      path = `/v2.1/merchants/${merchant}/transactions/history?${href.replace(/^[?&]/, "")}`;
      if (page === MAX_PAGES - 1) truncated = true;
    }

    // ── 2. Commissions (un appel de détail par vente, plafonné) ──────────────
    const { data: pending } = await supabase
      .from("sumup_transactions")
      .select("id")
      .is("detail_fetched_at", null)
      .limit(MAX_DETAIL_CALLS);

    let detailsFetched = 0;
    for (const row of pending ?? []) {
      try {
        const detail = await sumupGet(
          `/v2.1/merchants/${merchant}/transactions?id=${encodeURIComponent(row.id)}`,
        );
        await supabase
          .from("sumup_transactions")
          .update({
            fee_amount: money(detail?.fee_amount),
            vat_amount: money(detail?.vat_amount),
            tip_amount: money(detail?.tip_amount),
            entry_mode: detail?.entry_mode ?? null,
            detail_fetched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        detailsFetched++;
      } catch (e) {
        // Une vente dont le détail échoue ne doit pas faire tomber toute la
        // synchro : elle sera retentée au prochain passage.
        console.error(`sumup-sync: détail indisponible pour ${row.id}`, e);
      }
    }

    // ── 3. Virements ────────────────────────────────────────────────────────
    // start_date et end_date sont obligatoires, et end_date doit être
    // strictement postérieure à start_date.
    const payoutStart = state?.last_payout_date
      ? new Date(new Date(state.last_payout_date).getTime() - 7 * DAY_MS)
      : new Date(fallbackFrom);
    const todayIso = runStartedAt.toISOString().slice(0, 10);
    let startIso = payoutStart.toISOString().slice(0, 10);
    if (startIso >= todayIso) {
      startIso = new Date(runStartedAt.getTime() - DAY_MS).toISOString().slice(0, 10);
    }

    const payouts: SumUpPayout[] = await sumupGet(
      `/v1.0/merchants/${merchant}/payouts?start_date=${startIso}&end_date=${todayIso}&limit=9999&order=asc`,
    );

    let syncedPayouts = 0;
    if (Array.isArray(payouts) && payouts.length > 0) {
      const { error } = await supabase.from("sumup_payouts").upsert(
        payouts.map((p) => ({
          id: p.id,
          type: p.type,
          amount: money(p.amount) ?? 0,
          fee: money(p.fee),
          currency: p.currency ?? "EUR",
          date: p.date,
          status: p.status ?? null,
          reference: p.reference ?? null,
          transaction_code: p.transaction_code ?? null,
          raw: p,
          updated_at: runStartedAt.toISOString(),
        })),
        { onConflict: "id" },
      );
      if (error) throw new Error(`upsert sumup_payouts: ${error.message}`);
      syncedPayouts = payouts.length;
    }

    const lastPayoutDate = Array.isArray(payouts) && payouts.length > 0
      ? payouts.map((p) => p.date).sort().at(-1) ?? state?.last_payout_date ?? null
      : state?.last_payout_date ?? null;

    // Curseur non avancé si on a buté sur le garde-fou de pagination : le
    // prochain passage doit reprendre où on s'est arrêté.
    await supabase
      .from("sumup_sync_state")
      .update({
        last_synced_at: truncated ? (state?.last_synced_at ?? null) : runStartedAt.toISOString(),
        last_payout_date: lastPayoutDate,
        last_run_at: runStartedAt.toISOString(),
        last_error: null,
        transactions_synced: syncedTx,
        payouts_synced: syncedPayouts,
      })
      .eq("id", true);

    console.log(
      `sumup-sync: ${syncedTx} ventes, ${detailsFetched} commissions, ${syncedPayouts} lignes de virement`,
    );

    return json({
      ok: true,
      transactions_synced: syncedTx,
      details_fetched: detailsFetched,
      details_remaining: Math.max(0, (pending?.length ?? 0) - detailsFetched),
      payouts_synced: syncedPayouts,
      truncated,
      since: changesSince,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sumup-sync error", message);
    await supabase
      .from("sumup_sync_state")
      .update({ last_run_at: runStartedAt.toISOString(), last_error: message })
      .eq("id", true);
    return json({ error: message }, 500);
  }
});
