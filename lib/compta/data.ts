import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/compta/accounts";
import {
  accountMap,
  buildLedger,
  type BankTxRow,
  type CashRow,
  type EntryRow,
  type Movement,
  type RuleRow,
  type SettlementRow,
} from "@/lib/compta/ledger";
import { DEFAULT_SETTINGS, type FilingRow, type PeriodRow, type Settings } from "@/lib/compta/vat";

// Chargement de la comptabilité d'un exercice — partagé par la page, les
// exports (FEC, CSV, justificatifs) et les outils de Léa.
//
// Les tables de la migration 0035 ne sont pas encore dans les types générés :
// client non typé, et chaque forme lue est décrite dans lib/compta/ledger.ts.
// Si la migration n'est pas appliquée, `ready` vaut false et la page explique
// quoi faire au lieu de planter.

export type ComptaData = {
  ready: boolean;
  settings: Settings;
  accounts: Account[];
  accountsByCode: Map<string, Account>;
  movements: Movement[];
  periods: PeriodRow[];
  filings: FilingRow[];
  rules: RuleRow[];
  from: string;
  to: string;
  year: number;
  bankSyncedAt: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Bornes de l'exercice qui commence l'année `year`. */
export function exerciseBounds(year: number, startMonth: number): { from: string; to: string } {
  const from = `${year}-${pad(startMonth)}-01`;
  const endYear = startMonth === 1 ? year : year + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const last = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return { from, to: `${endYear}-${pad(endMonth)}-${pad(last)}` };
}

function isoAddDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export async function loadCompta(year: number, client?: SupabaseClient): Promise<ComptaData> {
  const supabase = client ?? ((await createClient()) as unknown as SupabaseClient);

  const settingsRes = await supabase.from("accounting_settings").select("*").maybeSingle<Settings>();
  const ready = !settingsRes.error;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(settingsRes.data ?? {}) };
  const { from, to } = exerciseBounds(year, settings.fiscal_year_start_month || 1);

  const [accountsRes, bankRes, cashRes, entriesRes, rulesRes, settleRes, periodsRes, filingsRes, syncRes] =
    await Promise.all([
      supabase.from("accounting_accounts").select("*").order("sort").returns<Account[]>(),
      supabase
        .from("bank_transactions")
        .select("id, side, amount_cents, status, operation_type, label, counterparty_name, reference, settled_at, emitted_at")
        .in("status", ["completed", "pending"])
        // Un mouvement en attente n'a pas encore de settled_at : on filtre
        // large sur emitted_at puis on recadre sur la date retenue plus bas.
        .gte("emitted_at", `${isoAddDays(from, -15)}T00:00:00Z`)
        .lte("emitted_at", `${to}T23:59:59Z`)
        .order("emitted_at", { ascending: false })
        .limit(5000)
        .returns<BankTxRow[]>(),
      supabase
        .from("cash_movements")
        .select("id, date, direction, amount, category, description")
        .gte("date", from)
        .lte("date", to)
        .returns<CashRow[]>(),
      supabase.from("accounting_entries").select("*").gte("entry_date", from).lte("entry_date", to).returns<EntryRow[]>(),
      supabase.from("accounting_rules").select("*").order("priority").returns<RuleRow[]>(),
      supabase
        .from("sumup_daily_settlements")
        .select("date, net_amount, fees")
        .gte("date", from)
        .lte("date", to)
        .returns<SettlementRow[]>(),
      supabase.from("accounting_periods").select("*").returns<PeriodRow[]>(),
      supabase.from("accounting_vat_filings").select("*").returns<FilingRow[]>(),
      supabase.from("qonto_sync_state").select("last_synced_at").maybeSingle<{ last_synced_at: string | null }>(),
    ]);

  const accounts = accountsRes.data && accountsRes.data.length > 0 ? accountsRes.data : [];
  const accountsByCode = accountMap(accounts);

  const movements = buildLedger({
    bank: bankRes.data ?? [],
    cash: cashRes.data ?? [],
    entries: entriesRes.data ?? [],
    rules: rulesRes.data ?? [],
    accounts: accountsByCode,
    settlements: settleRes.data ?? [],
  }).filter((m) => m.date >= from && m.date <= to);

  return {
    ready,
    settings,
    accounts: [...accountsByCode.values()],
    accountsByCode,
    movements,
    periods: periodsRes.data ?? [],
    filings: filingsRes.data ?? [],
    rules: rulesRes.data ?? [],
    from,
    to,
    year,
    bankSyncedAt: syncRes.data?.last_synced_at ?? null,
  };
}
