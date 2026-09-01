// Supabase Edge Function — Point financier : calcule le score de santé
// financière, l'archive dans financial_snapshots et l'envoie sur Telegram.
//
// Raison d'être : le dashboard répondait « où j'en suis ? » par une marge nette
// comptable qui a dérivé de 12 800 € de la réalité en 8 mois, sans que rien ne
// le signale. Ici le calcul part de la banque (Qonto) et de la caisse espèces,
// pas de la saisie manuelle, et il vient à Robin au lieu d'attendre qu'il aille
// le chercher.
//
// Principe non négociable : si la banque n'est pas connectée, cette fonction
// n'invente PAS un score. Elle le dit. Un chiffre faux est pire que pas de
// chiffre — c'est exactement ce qui a coûté 12 800 € d'illusion.
//
// Secrets : TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID, CRON_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_OWNER_CHAT_ID = Deno.env.get("TELEGRAM_OWNER_CHAT_ID") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Fenêtres d'observation.
const BURN_WINDOW_DAYS = 90; // charges moyennes : assez long pour lisser
const RECENT_WINDOW_DAYS = 30; // activité récente
const DAY_MS = 86_400_000;

// Barème du score, explicite et documenté — il doit rester explicable à voix
// haute, sinon Robin ne lui fera pas confiance (et il aura raison).
const RUNWAY_POINTS = 50; // combien de mois on tient sans rentrée d'argent
const RUNWAY_TARGET_MONTHS = 6;
const COVERAGE_POINTS = 25; // le CA couvre-t-il les charges ?
const COVERAGE_TARGET_RATIO = 1.2;
const SECURED_POINTS = 25; // encaissements déjà signés à venir
const SECURED_TARGET_MONTHS = 2;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

async function sendTelegram(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_OWNER_CHAT_ID, text: text.slice(0, 4000) }),
  });
}

function scoreLabel(score: number): string {
  if (score >= 75) return "solide";
  if (score >= 55) return "correct";
  if (score >= 35) return "tendu";
  return "critique";
}

// Points attribués proportionnellement jusqu'à une cible, plafonnés.
function scaled(value: number, target: number, points: number): number {
  if (target <= 0) return points;
  return Math.max(0, Math.min(points, (value / target) * points));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // `silent` permet d'appeler la fonction pour recalculer sans notifier
  // (utile quand l'agent veut juste lire le score à la demande).
  let silent = false;
  try {
    const body = await req.json();
    silent = Boolean(body?.silent);
  } catch {
    // corps vide : comportement par défaut (envoi Telegram)
  }

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const burnFromIso = new Date(now.getTime() - BURN_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  const recentFromIso = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);

  const [accountsRes, cashRes, revenuesRes, expensesRes, bookingsRes, bankTxRes, prevSnapRes] = await Promise.all([
    supabase.from("bank_accounts").select("balance_cents, balance_updated_at").neq("status", "closed"),
    supabase.from("cash_balance").select("balance, last_movement_date").maybeSingle(),
    supabase.from("revenues").select("amount, date").gte("date", burnFromIso),
    supabase.from("expenses").select("amount, date").gte("date", burnFromIso),
    supabase
      .from("bookings")
      .select("date, status, deposit_amount, deposit_paid, balance_due")
      .gte("date", todayIso),
    // Les débits bancaires réels : la seule mesure fiable des charges, puisque
    // c'est précisément ce qui n'était pas saisi à la main.
    supabase
      .from("bank_transactions")
      .select("amount_cents, settled_at")
      .eq("side", "debit")
      .eq("status", "completed")
      .gte("settled_at", `${burnFromIso}T00:00:00Z`),
    supabase
      .from("financial_snapshots")
      .select("date, score, treasury")
      .lt("date", todayIso)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const accounts = accountsRes.data ?? [];
  const bankConnected = accounts.length > 0;
  const bankBalance = bankConnected
    ? accounts.reduce((s, a) => s + (a.balance_cents ?? 0), 0) / 100
    : null;
  const cashBalance = Number(cashRes.data?.balance ?? 0);

  // Sans la banque, on ne calcule pas de score. On explique pourquoi.
  if (!bankConnected) {
    const message =
      "⚠️ Point financier impossible\n\n" +
      "La banque n'est pas connectée : je ne peux pas calculer ta trésorerie réelle, " +
      "donc je ne calcule pas de score.\n\n" +
      `Caisse espèces : ${eur(cashBalance)}\n\n` +
      "Je préfère ne rien afficher plutôt qu'un chiffre basé sur la seule saisie manuelle — " +
      "c'est ce qui avait créé l'écart de 12 800 €.\n\n" +
      "Pour débloquer : ajoute le secret QONTO_API_KEY dans Supabase, puis lance la synchro.";
    if (!silent) await sendTelegram(message);
    return json({ ok: false, reason: "bank_not_connected", cash_balance: cashBalance });
  }

  const treasury = (bankBalance ?? 0) + cashBalance;

  // ── Charges mensuelles moyennes ────────────────────────────────────────────
  // Priorité aux débits bancaires réels ; la table expenses ne sert de repli
  // que tant que la synchro n'a rien remonté, et on le signale alors.
  const bankTx = bankTxRes.data ?? [];
  const bankDebits90 = bankTx.reduce((s, t) => s + (t.amount_cents ?? 0), 0) / 100;
  const expenses = expensesRes.data ?? [];
  const declaredExpenses90 = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const cashOutRes = await supabase
    .from("cash_movements")
    .select("amount")
    .eq("direction", "out")
    .gte("date", burnFromIso);
  const cashOut90 = (cashOutRes.data ?? []).reduce((s, m) => s + Number(m.amount ?? 0), 0);

  const burnSource = bankTx.length > 0 ? "bank" : "declared";
  const spend90 = (burnSource === "bank" ? bankDebits90 : declaredExpenses90) + cashOut90;
  const monthlyBurn = spend90 / (BURN_WINDOW_DAYS / 30);

  const revenues = revenuesRes.data ?? [];
  const revenue30 = revenues
    .filter((r) => r.date >= recentFromIso)
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const expenses30 =
    burnSource === "bank"
      ? bankTx
          .filter((t) => (t.settled_at ?? "").slice(0, 10) >= recentFromIso)
          .reduce((s, t) => s + (t.amount_cents ?? 0), 0) / 100
      : expenses.filter((e) => e.date >= recentFromIso).reduce((s, e) => s + Number(e.amount ?? 0), 0);

  // ── Encaissements déjà sécurisés (réservations confirmées à venir) ─────────
  const outstanding = (bookingsRes.data ?? [])
    .filter((b) => b.status !== "cancelled")
    .reduce(
      (s, b) => s + (b.deposit_paid ? 0 : Number(b.deposit_amount ?? 0)) + Number(b.balance_due ?? 0),
      0,
    );

  // ── Score ──────────────────────────────────────────────────────────────────
  const runwayMonths = monthlyBurn > 0 ? treasury / monthlyBurn : null;
  const runwayScore = runwayMonths === null
    ? RUNWAY_POINTS
    : scaled(runwayMonths, RUNWAY_TARGET_MONTHS, RUNWAY_POINTS);

  const coverageRatio = expenses30 > 0 ? revenue30 / expenses30 : null;
  const coverageScore = coverageRatio === null
    ? COVERAGE_POINTS
    : scaled(coverageRatio, COVERAGE_TARGET_RATIO, COVERAGE_POINTS);

  const securedMonths = monthlyBurn > 0 ? outstanding / monthlyBurn : null;
  const securedScore = securedMonths === null
    ? SECURED_POINTS
    : scaled(securedMonths, SECURED_TARGET_MONTHS, SECURED_POINTS);

  const score = Math.round(runwayScore + coverageScore + securedScore);
  const label = scoreLabel(score);

  const details = {
    burn_source: burnSource,
    bank_debits_90d: Math.round(bankDebits90),
    declared_expenses_90d: Math.round(declaredExpenses90),
    cash_out_90d: Math.round(cashOut90),
    runway: { months: runwayMonths, score: Math.round(runwayScore), max: RUNWAY_POINTS },
    coverage: { ratio: coverageRatio, score: Math.round(coverageScore), max: COVERAGE_POINTS },
    secured: { months: securedMonths, score: Math.round(securedScore), max: SECURED_POINTS },
  };

  await supabase.from("financial_snapshots").upsert(
    {
      date: todayIso,
      captured_at: now.toISOString(),
      bank_balance: bankBalance,
      cash_balance: cashBalance,
      treasury,
      monthly_burn: Math.round(monthlyBurn),
      runway_months: runwayMonths,
      outstanding,
      revenue_30d: revenue30,
      expenses_30d: Math.round(expenses30),
      score,
      score_label: label,
      details,
    },
    { onConflict: "date" },
  );

  // ── Message ────────────────────────────────────────────────────────────────
  const prev = prevSnapRes.data;
  const scoreDelta = prev?.score != null ? score - prev.score : null;
  const trend = scoreDelta === null
    ? ""
    : scoreDelta > 0
      ? ` (+${scoreDelta} depuis le ${prev!.date})`
      : scoreDelta < 0
        ? ` (${scoreDelta} depuis le ${prev!.date})`
        : " (stable)";

  const lines = [
    `💶 Point financier — score ${score}/100 (${label})${trend}`,
    "",
    `Trésorerie réelle : ${eur(treasury)}`,
    `  • banque ${eur(bankBalance ?? 0)} · espèces ${eur(cashBalance)}`,
    `Charges mensuelles : ${eur(monthlyBurn)}`,
    runwayMonths === null
      ? "Autonomie : illimitée (aucune charge observée)"
      : `Autonomie : ${runwayMonths.toFixed(1)} mois sans aucune rentrée`,
    "",
    `CA 30 j : ${eur(revenue30)} · charges 30 j : ${eur(expenses30)}`,
    `Déjà signé à encaisser : ${eur(outstanding)}`,
  ];

  if (burnSource === "declared") {
    lines.push(
      "",
      "⚠️ Charges calculées depuis la saisie manuelle uniquement (aucun mouvement bancaire importé) — probablement sous-estimées.",
    );
  }

  // Le point qui compte le plus, dit en une phrase.
  if (runwayMonths !== null && runwayMonths < 3) {
    lines.push("", `🔴 Priorité : moins de 3 mois d'autonomie. Il faut soit rentrer du cash, soit couper des charges.`);
  } else if (coverageRatio !== null && coverageRatio < 1) {
    lines.push("", `🟠 Sur 30 jours tu dépenses plus que tu n'encaisses (${Math.round(coverageRatio * 100)} % de couverture).`);
  }

  if (!silent) await sendTelegram(lines.join("\n"));

  return json({
    ok: true,
    score,
    label,
    treasury,
    bank_balance: bankBalance,
    cash_balance: cashBalance,
    monthly_burn: Math.round(monthlyBurn),
    runway_months: runwayMonths,
    outstanding,
    revenue_30d: revenue30,
    expenses_30d: Math.round(expenses30),
    details,
  });
});
