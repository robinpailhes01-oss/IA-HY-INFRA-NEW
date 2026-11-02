import { CalendarDays, Landmark, TrendingUp, Users } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { AddExpenseDialog } from "@/components/finances/add-expense-dialog";
import { AddRevenueDialog } from "@/components/finances/add-revenue-dialog";
import { AddBookingDialog } from "@/components/bookings/add-booking-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Num } from "@/components/ui/num";
import { WeatherWidget, type WeatherDay } from "@/components/dashboard/weather-widget";
import { UpcomingBookings, type DayWeather, type UpcomingBooking } from "@/components/dashboard/upcoming-bookings";
import { RecentTransactions, mergeTransactions } from "@/components/dashboard/recent-transactions";
import { CardLink } from "@/components/overview/card-link";
import { CockpitKpi } from "@/components/overview/cockpit-kpi";
import { HotLeads, type HotLead } from "@/components/overview/hot-leads";
import { LeaBrief, type BriefSignals } from "@/components/overview/lea-brief";
import { SeasonCard } from "@/components/overview/season-card";
import { formatEur } from "@/lib/format";

// ═══════════════════════════════════════════════════════════════════════
// VUE D'ENSEMBLE — le cockpit, piloté par l'agent IA.
//
// Robin y vient chercher trois réponses, dans cet ordre (docs/DESIGN.md §1) :
//   1. Quelqu'un attend-il une réponse de moi ?  → le brief de Léa
//   2. Combien j'ai en banque, combien je vais encaisser ? → les chiffres
//   3. Qu'est-ce qui sort cette semaine ? → les prochaines sorties
// La page est construite dans cet ordre, sur téléphone comme sur bureau.
// ═══════════════════════════════════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;
const PARIS = "Europe/Paris";
const MOIS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

type FutureBookingRow = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  offer_name: string | null;
  party_size: number | null;
  total_amount: number | null;
  status: string | null;
  deposit_amount: number | null;
  deposit_paid: boolean | null;
  balance_due: number | null;
  balance_due_date: string | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

type ActiveLeadRow = {
  id: string;
  status: string | null;
  needs_human_intervention: boolean | null;
  interested_offer: string | null;
  desired_date: string | null;
};

type HotLeadRow = Omit<HotLead, "whatsapp_name"> & {
  status: string | null;
  // Objet ou tableau selon la façon dont PostgREST résout la relation.
  wa_conversations: { customer_name: string | null } | { customer_name: string | null }[] | null;
};

type DatedLeadRow = {
  id: string;
  status: string | null;
  needs_human_intervention: boolean | null;
  desired_date: string;
};

type SnapshotRow = { date: string; bank_balance: number | null; runway_months: number | null };

/** Un lead réservé ou perdu n'appelle plus d'action. */
const isActive = (status: string | null) => status !== "booked" && status !== "lost";

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Client";
}

/** « 1 avril » → « 1 avr. » pour les étiquettes de période. */
function shortDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return `${d.getUTCDate()} ${MOIS_ABBR[d.getUTCMonth()]}`;
}

function sinceLabel(iso: string, now: Date): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  const d = new Date(iso);
  return `le ${d.getUTCDate()} ${MOIS_ABBR[d.getUTCMonth()]}`;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  // financial_snapshots (migration 0030) n'est pas encore dans les types
  // générés : on l'interroge sans typage plutôt que de caster chaque ligne.
  const untyped = supabase as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  // « Aujourd'hui » est celui de Robin, à Carnon — pas celui du serveur (UTC
  // sur Vercel). Sans ça, entre minuit et 1 h (2 h l'été), le cockpit datait
  // l'en-tête du jour J mais comptait encore les sorties de la veille.
  // en-CA : le seul format de date localisé qui sort en AAAA-MM-JJ.
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: PARIS }).format(now);
  const year = Number(todayIso.slice(0, 4));
  const monthIdx = Number(todayIso.slice(5, 7)) - 1;
  // Midi UTC : ajouter des jours ne fait jamais basculer la date.
  const todayNoon = Date.parse(`${todayIso}T12:00:00Z`);
  const isoIn = (days: number) => new Date(todayNoon + days * DAY_MS).toISOString().slice(0, 10);
  const agoTs = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  const in7Iso = isoIn(7);
  const in10Iso = isoIn(10);

  const [
    profileRes,
    goalRes,
    futureRes,
    newLeadsRes,
    prevLeadsRes,
    recentLeadsRes,
    activeLeadsRes,
    weatherRes,
    revenuesRes,
    expensesRes,
    hotLeadsRes,
    datedLeadsRes,
    awaitingReplyRes,
    bankAccountsRes,
    snapshotsRes,
  ] = await Promise.all([
    user
      ? supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("goals")
      .select("*")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // ── Toutes les sorties à venir, annulées comprises (filtrées plus bas) ──
    // Une seule requête nourrit le compteur, le reste à encaisser, la liste
    // des prochaines sorties et les signaux du brief.
    supabase
      .from("bookings")
      .select(
        "id, date, start_time, end_time, offer_name, party_size, total_amount, status, deposit_amount, deposit_paid, balance_due, balance_due_date, customers(first_name, last_name)",
      )
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .returns<FutureBookingRow[]>(),
    supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", agoTs(30)),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", agoTs(60))
      .lt("created_at", agoTs(30)),
    // Huit semaines de leads, pour la courbe de la tuile.
    supabase
      .from("leads")
      .select("created_at")
      .gte("created_at", agoTs(56))
      .returns<{ created_at: string | null }[]>(),
    // Même périmètre que la cloche de l'en-tête (layout) : leads non archivés.
    // Sans ça, le brief et la cloche annonceraient deux nombres différents.
    supabase
      .from("leads")
      .select("id, status, needs_human_intervention, interested_offer, desired_date")
      .eq("archived", false)
      .returns<ActiveLeadRow[]>(),
    // 16 jours : de quoi couvrir l'horizon des prévisions pour croiser la
    // météo avec chaque sortie réservée, pas seulement les 5 jours affichés.
    supabase
      .from("weather_cache")
      .select("date, rating, wind_speed_kmh, wind_direction, wave_height_m, water_temp_c, swell_m")
      .gte("date", todayIso)
      .order("date", { ascending: true })
      .limit(16)
      .returns<WeatherDay[]>(),
    // Depuis le 1er janvier de l'an dernier : l'année en cours, la comparaison
    // à même date l'an passé, et une saison qui aurait commencé l'an dernier.
    supabase
      .from("revenues")
      .select("id, amount, date, type, note")
      .gte("date", `${year - 1}-01-01`)
      .order("date", { ascending: false })
      .returns<{ id: string; amount: number | null; date: string; type: string | null; note: string | null }[]>(),
    supabase
      .from("expenses")
      .select("id, amount, date, category, description")
      .gte("date", isoIn(-365))
      .order("date", { ascending: false })
      .returns<{ id: string; amount: number | null; date: string; category: string | null; description: string | null }[]>(),
    // ── Leads les plus chauds = ceux qui ont une date souhaitée ──
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, source_channel, interested_offer, occasion, party_size, desired_date, desired_time_slot, score, status, wa_conversations(customer_name)",
      )
      .eq("archived", false)
      .gte("desired_date", todayIso)
      .order("score", { ascending: false, nullsFirst: false })
      .order("desired_date", { ascending: true })
      .limit(30)
      .returns<HotLeadRow[]>(),
    // Tous les leads datés à venir, en version légère : le compte exact
    // derrière les tuiles ci-dessus (plafonnées à 30 lignes) et les prospects
    // de la semaine pour le brief.
    supabase
      .from("leads")
      .select("id, status, needs_human_intervention, desired_date")
      .eq("archived", false)
      .gte("desired_date", todayIso)
      .returns<DatedLeadRow[]>(),
    // ── Clients dont le dernier message attend encore une réponse ──
    // Signal le plus fort de perte de prospect : ils ont écrit, personne n'a
    // répondu. Rien à voir avec un score — c'est nous qui bloquons.
    supabase.from("lead_last_message").select("lead_id, last_message_at").eq("last_from_me", false),
    // ── Solde bancaire réel, alimenté par la synchro Qonto ──
    supabase
      .from("bank_accounts")
      .select("balance_cents, balance_updated_at")
      .neq("status", "closed")
      .returns<{ balance_cents: number | null; balance_updated_at: string | null }[]>(),
    // ── Photo financière quotidienne (finance-pulse) : historique du solde et
    // nombre de mois de charges couverts — le même calcul que celui du
    // Manager, pour que le brief et l'agent disent la même chose.
    untyped
      .from("financial_snapshots")
      .select("date, bank_balance, runway_months")
      .order("date", { ascending: false })
      .limit(30)
      .returns<SnapshotRow[]>(),
  ]);

  // ── Objectif de saison ───────────────────────────────────────────
  const goal = goalRes.data;
  const periodStart = goal?.period_start ?? `${year}-06-01`;
  const periodEnd = goal?.period_end ?? `${year}-08-31`;

  // ── Chiffre d'affaires ───────────────────────────────────────────
  // CA & marge : uniquement depuis la table revenues (évite le double-comptage).
  const revenues = revenuesRes.data ?? [];
  const sum = (rows: { amount: number | null }[]) => rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const inYear = (d: string) => d.slice(0, 4) === String(year);
  const caYtd = sum(revenues.filter((r) => inYear(r.date)));
  const caMonth = sum(revenues.filter((r) => inYear(r.date) && Number(r.date.slice(5, 7)) - 1 === monthIdx));
  // À date égale l'an dernier : comparer une année entière à onze mois ferait
  // croire à une chute en fin d'année.
  const sameDayLastYear = `${year - 1}${todayIso.slice(4)}`;
  const caLastYtd = sum(revenues.filter((r) => r.date.startsWith(String(year - 1)) && r.date <= sameDayLastYear));
  const caDelta = caLastYtd > 0 ? Math.round(((caYtd - caLastYtd) / caLastYtd) * 100) : null;

  // L'objectif porte sur une PÉRIODE (la saison), pas sur l'année civile : on
  // compare donc le CA encaissé entre ses deux dates. Un objectif 2027 créé
  // en décembre partira de zéro au lieu d'afficher le CA 2026.
  const seasonCa = sum(revenues.filter((r) => r.date >= periodStart && r.date <= periodEnd));
  const strong = goal?.target_strong ?? 0;

  // Le graphique s'arrête au mois courant : afficher des mois futurs à zéro
  // écraserait visuellement les mois réalisés et laisserait croire à une chute.
  const monthly = Array<number>(12).fill(0);
  for (const r of revenues) if (inYear(r.date)) monthly[Number(r.date.slice(5, 7)) - 1] += r.amount ?? 0;
  const months = monthly
    .slice(0, monthIdx + 1)
    .map((value, i) => ({ label: MOIS_COURT[i], value, display: formatEur(value) }));

  // ── Réservations à venir ─────────────────────────────────────────
  const future = (futureRes.data ?? []).filter((b) => b.status !== "cancelled");
  // Même définition que sur la page Réservations : le reste à encaisser ne
  // compte QUE les sorties à venir. Les sorties passées non soldées relèvent
  // d'une régularisation (elles sont listées là-bas), pas d'argent à attendre.
  const outstanding = future.reduce(
    (s, b) => s + (b.deposit_paid ? 0 : b.deposit_amount ?? 0) + (b.balance_due ?? 0),
    0,
  );
  const upcomingCount = future.length;
  const thisWeek = future.filter((b) => b.date <= in7Iso).length;
  // Le carnet des huit prochaines semaines, semaine en cours d'abord.
  const weeksAhead = Array.from({ length: 8 }, (_, w) => {
    const from = isoIn(w * 7);
    const to = isoIn((w + 1) * 7);
    return future.filter((b) => b.date >= from && b.date < to).length;
  });

  const upcoming: UpcomingBooking[] = future.slice(0, 5).map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.start_time,
    endTime: b.end_time,
    offerName: b.offer_name,
    customerName: fullName(b.customers?.first_name ?? null, b.customers?.last_name ?? null),
    partySize: b.party_size,
    amount: b.total_amount,
    status: b.status,
    depositPaid: b.deposit_paid,
  }));

  // ── Météo croisée avec le planning ───────────────────────────────
  const weatherDays = weatherRes.data ?? [];
  const weatherByDate: Record<string, DayWeather> = {};
  for (const w of weatherDays) weatherByDate[w.date.slice(0, 10)] = { rating: w.rating, wind: w.wind_speed_kmh };
  const bookedByDate: Record<string, number> = {};
  for (const b of future) bookedByDate[b.date] = (bookedByDate[b.date] ?? 0) + 1;
  const riskyDay = Object.keys(bookedByDate)
    .sort()
    .find((d) => weatherByDate[d]?.rating === "discouraged");

  // ── Leads ────────────────────────────────────────────────────────
  const newLeadsCount = newLeadsRes.count ?? 0;
  const prevLeadsCount = prevLeadsRes.count;
  const leadsDiff = prevLeadsCount != null ? newLeadsCount - prevLeadsCount : null;
  const leadWeeks = Array<number>(8).fill(0);
  for (const l of recentLeadsRes.data ?? []) {
    if (!l.created_at) continue;
    const weeksAgo = Math.floor((now.getTime() - new Date(l.created_at).getTime()) / (7 * DAY_MS));
    if (weeksAgo >= 0 && weeksAgo < 8) leadWeeks[7 - weeksAgo] += 1;
  }

  const activeLeads = (activeLeadsRes.data ?? []).filter((l) => isActive(l.status));
  const activeById = new Map(activeLeads.map((l) => [l.id, l]));
  // Même définition que la cloche et le filtre « sans réponse » de la page
  // Leads : un lead escaladé par Léa est « à reprendre », pas « sans réponse ».
  const awaitingLeads = (awaitingReplyRes.data ?? [])
    .map((r) => (r.lead_id ? activeById.get(r.lead_id) : undefined))
    .filter((l): l is ActiveLeadRow => Boolean(l) && !l?.needs_human_intervention);
  // Le client en attente dont la date souhaitée est la plus proche : c'est
  // lui que le brief nomme.
  const featured = awaitingLeads
    .filter((l) => l.desired_date && l.desired_date >= todayIso)
    .sort((a, b) => (a.desired_date ?? "").localeCompare(b.desired_date ?? ""))[0];
  const takeoverCount = activeLeads.filter((l) => l.needs_human_intervention).length;

  // ── Leads les plus chauds (déjà triés score ↓ puis date ↑) ──
  // Le nom WhatsApp sert de repli quand Léa n'a pas encore noté le prénom —
  // comme sur la page Leads, pour qu'un même prospect n'y soit pas « Lead ».
  const hotLeads: HotLead[] = (hotLeadsRes.data ?? [])
    .filter((l) => isActive(l.status))
    .slice(0, 6)
    .map(({ wa_conversations, status, ...l }) => {
      void status;
      const conv = Array.isArray(wa_conversations) ? wa_conversations[0] : wa_conversations;
      return { ...l, whatsapp_name: conv?.customer_name ?? null };
    });
  const datedLeads = (datedLeadsRes.data ?? []).filter((l) => isActive(l.status));
  // Prospects de la semaine : la règle exacte du seau « Sortie imminente » de
  // la vue Priorité (lib/leads, priorityBucket), où mène le lien du brief. Un
  // lead escaladé ou sans réponse est déjà compté plus haut dans le brief ;
  // le recompter ici annoncerait un nombre que la vue Priorité ne montre pas.
  const awaitingIds = new Set(awaitingLeads.map((l) => l.id));
  const imminentCount = datedLeads.filter(
    (l) => l.desired_date <= in7Iso && !l.needs_human_intervention && !awaitingIds.has(l.id),
  ).length;

  // ── Trésorerie réelle ────────────────────────────────────────────
  // Somme des soldes bancaires remontés par qonto-sync. null tant qu'aucun
  // compte n'a été synchronisé — on affiche alors « Qonto non connecté »
  // plutôt qu'un 0 € qui ressemblerait à un compte vide.
  const bankAccounts = bankAccountsRes.data ?? [];
  const treasury = bankAccounts.length
    ? bankAccounts.reduce((s, a) => s + (a.balance_cents ?? 0), 0) / 100
    : null;
  const lastBalanceAt = bankAccounts
    .map((a) => a.balance_updated_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  // Historique du solde : les photos quotidiennes, puis le solde Qonto de
  // l'instant comme dernier point — le point final de la courbe, c'est
  // maintenant.
  const snapshots = (snapshotsRes.data ?? []).filter((s) => s.date < todayIso && s.bank_balance != null).reverse();
  // numeric Postgres → nombre ou chaîne selon la taille : Number() dans les deux cas.
  const treasuryTrend =
    treasury != null && snapshots.length >= 2 ? [...snapshots.map((s) => Number(s.bank_balance ?? 0)), treasury] : [];

  // Mois de charges couverts : la photo du jour si elle a moins d'une
  // semaine (même calcul que le Manager), sinon solde ÷ charges moyennes
  // des 90 derniers jours.
  const freshSnap = (snapshotsRes.data ?? []).find((s) => s.date >= isoIn(-7) && s.runway_months != null);
  const burn90 = sum((expensesRes.data ?? []).filter((e) => e.date >= isoIn(-90))) / 3;
  const runwayMonths =
    freshSnap?.runway_months != null
      ? Number(freshSnap.runway_months)
      : treasury != null && burn90 > 0
        ? treasury / burn90
        : null;

  // ── Signaux du brief ─────────────────────────────────────────────
  // Soldes dus le jour J dans les 10 jours. Une sortie dont l'acompte n'est
  // pas versé relève de l'acompte, pas du solde (même règle qu'avant).
  const balances = future.filter(
    (b) => b.deposit_paid !== false && (b.balance_due ?? 0) > 0 && b.balance_due_date && b.balance_due_date <= in10Iso,
  );
  const next = future[0];
  const signals: BriefSignals = {
    awaiting: awaitingLeads.length,
    awaitingFeatured: featured?.desired_date ? { offer: featured.interested_offer, date: featured.desired_date } : null,
    takeover: takeoverCount,
    imminentLeads: imminentCount,
    toConfirm: future.filter((b) => b.status === "pending" && b.date <= in7Iso).length,
    weatherRisk: riskyDay
      ? { date: riskyDay, count: bookedByDate[riskyDay], wind: weatherByDate[riskyDay]?.wind ?? null }
      : null,
    balancesSoon: balances.length
      ? { count: balances.length, amount: balances.reduce((s, b) => s + (b.balance_due ?? 0), 0) }
      : null,
    depositsPending: future.filter((b) => b.deposit_paid === false).length,
    runwayMonths,
    outstanding,
    nextOuting: next
      ? {
          date: next.date,
          time: next.start_time,
          offer: next.offer_name,
          customer: fullName(next.customers?.first_name ?? null, next.customers?.last_name ?? null),
          rating: weatherByDate[next.date]?.rating ?? null,
        }
      : null,
    todayIso,
  };

  // ── En-tête : la date et l'heure de Robin, pas celles du serveur ──
  const parisDate = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  // formatToParts, pas format() : en fr-FR l'heure seule s'écrit « 22 h », et
  // Number("22 h") valait NaN — le cockpit disait « Bonjour » à minuit.
  const parisHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: PARIS, hour: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .find((p) => p.type === "hour")?.value ?? 12,
  );
  const parisTime = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, hour: "numeric", minute: "2-digit" })
    .format(now)
    .replace(":", " h ");
  const greeting = parisHour >= 18 || parisHour < 5 ? "Bonsoir" : "Bonjour";
  const firstName = profileRes.data?.first_name?.trim() || null;

  // Où en est la saison, en une ligne.
  const pctStrong = strong > 0 ? Math.round((seasonCa / strong) * 100) : null;
  const seasonLine = !goal ? (
    <>
      {upcomingCount} {upcomingCount > 1 ? "sorties" : "sortie"} au planning · {newLeadsCount} nouveaux leads en 30 jours.
    </>
  ) : todayIso < periodStart ? (
    <>
      Avant-saison — ouverture le {shortDate(periodStart)} · {upcomingCount}{" "}
      {upcomingCount > 1 ? "sorties déjà" : "sortie déjà"} au planning.
    </>
  ) : todayIso <= periodEnd ? (
    <>
      Saison en cours — encore {Math.max(0, Math.round((Date.parse(periodEnd) - Date.parse(todayIso)) / DAY_MS))}{" "}
      jours{pctStrong != null ? <> · <Num>{`${pctStrong} %`}</Num> de l&apos;objectif fort</> : null}.
    </>
  ) : (
    <>
      Saison {periodEnd.slice(0, 4)} bouclée
      {pctStrong != null ? <> à <Num>{`${pctStrong} %`}</Num> de l&apos;objectif fort</> : null} ·{" "}
      {upcomingCount} {upcomingCount > 1 ? "sorties déjà" : "sortie déjà"} au planning.
    </>
  );

  const recentTransactions = mergeTransactions(revenues, expensesRes.data ?? [], 8);

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader
        eyebrow={parisDate}
        title={
          firstName ? (
            <>
              {greeting} <em>{firstName}</em>
            </>
          ) : (
            greeting
          )
        }
        description={seasonLine}
        actions={
          // Mobile : l'action principale sur toute la largeur, les deux
          // secondaires côte à côte dessous, chacune à 44 px de haut (minimum
          // tactile). Porté ici plutôt que dans les dialogues, qui servent
          // aussi ailleurs. Les boutons portent `shrink-0 whitespace-nowrap` :
          // sans grille, ils débordaient de l'écran au lieu de passer dessous.
          <div className="grid w-full grid-cols-2 gap-2 [&>button]:h-11 [&>button]:px-4 [&>button:first-child]:col-span-2 sm:flex sm:w-auto sm:[&>button]:h-10 sm:[&>button:first-child]:col-span-1">
            <AddBookingDialog />
            <AddExpenseDialog />
            <AddRevenueDialog />
          </div>
        }
        className="mb-1"
      />

      <LeaBrief signals={signals} updatedAt={parisTime} />

      {/* ── Les chiffres ─────────────────────────────────────────────
          La trésorerie d'abord et seule en dégradé : c'est elle qui dit si
          Robin dort bien. Le CA à côté est un résultat, pas de l'argent
          disponible — les poser ensemble empêche de lire l'un pour l'autre. */}
      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-4 lg:gap-5 xl:grid-cols-4">
        {treasury === null ? (
          <CockpitKpi
            label="Trésorerie réelle"
            icon={<Landmark />}
            accent="navy"
            missing="Qonto non connecté"
            hint="À relier dans Paramètres"
            href="/settings"
            index={0}
          />
        ) : (
          <CockpitKpi
            label="Trésorerie réelle"
            icon={<Landmark />}
            accent="navy"
            value={treasury}
            format="eur"
            primary
            hint={`Qonto · ${lastBalanceAt ? `maj ${sinceLabel(lastBalanceAt, now)}` : "jamais synchronisé"}`}
            visual={treasuryTrend.length > 1 ? { kind: "line", values: treasuryTrend } : undefined}
            href="/finances"
            index={0}
          />
        )}
        <CockpitKpi
          label={`Chiffre d'affaires ${year}`}
          icon={<TrendingUp />}
          accent="ocean"
          value={caYtd}
          format="eur"
          delta={
            caDelta != null
              ? { value: `${caDelta >= 0 ? "+" : "−"}${Math.abs(caDelta)} %`, positive: caDelta >= 0 }
              : undefined
          }
          hint={
            caDelta != null ? (
              `vs même date ${year - 1}`
            ) : (
              <>
                dont <Num>{formatEur(caMonth)}</Num> en {MOIS_LONG[monthIdx]}
              </>
            )
          }
          visual={{ kind: "line", values: monthly.slice(0, monthIdx + 1) }}
          href="/finances"
          index={1}
        />
        <CockpitKpi
          label="Nouveaux leads · 30 j"
          icon={<Users />}
          accent="indigo"
          value={newLeadsCount}
          delta={
            leadsDiff != null && leadsDiff !== 0
              ? { value: `${leadsDiff > 0 ? "+" : "−"}${Math.abs(leadsDiff)}`, positive: leadsDiff > 0 }
              : undefined
          }
          hint={leadsDiff == null ? "créés ces 30 derniers jours" : leadsDiff === 0 ? "autant qu'avant" : "vs 30 j d'avant"}
          visual={{ kind: "line", values: leadWeeks }}
          href="/leads"
          index={2}
        />
        <CockpitKpi
          label="Réservations à venir"
          icon={<CalendarDays />}
          accent="aqua"
          value={upcomingCount}
          hint={
            thisWeek > 0
              ? `dont ${thisWeek} sous 7 jours`
              : upcomingCount > 0
                ? "rien sous 7 jours"
                : "planning vide"
          }
          visual={upcomingCount > 0 ? { kind: "bars", values: weeksAhead } : undefined}
          href="/bookings"
          index={3}
        />
      </section>

      {/* ── Deux colonnes qui se remplissent indépendamment ─────────────
          Sur grand écran : la saison et les leads à gauche, les sorties et
          la météo à droite — deux vraies colonnes, pour qu'une carte courte
          ne laisse pas un trou sous elle. La dernière carte de chaque colonne
          s'étire (flex-1) : les deux colonnes finissent sur la même ligne.
          Sous `xl`, `contents` efface les deux conteneurs : les quatre cartes
          redeviennent enfants directs de la grille et `order` les classe pour
          le téléphone — sorties, leads, saison, météo. */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-12">
        <div className="contents xl:col-span-8 xl:flex xl:flex-col xl:gap-5">
          <SeasonCard
            className="rise delay-3 order-3 xl:order-none"
            year={year}
            months={months}
            caMonth={caMonth}
            monthLabel={MOIS_LONG[monthIdx]}
            outstanding={outstanding}
            closed={todayIso > periodEnd}
            goal={
              goal && strong > 0
                ? {
                    min: goal.target_min ?? 0,
                    medium: goal.target_medium ?? 0,
                    strong,
                    current: seasonCa,
                    periodLabel: `${shortDate(periodStart)} au ${shortDate(periodEnd)}`,
                  }
                : null
            }
          />
          <HotLeads
            leads={hotLeads}
            total={datedLeads.length}
            className="rise delay-4 order-2 xl:order-none xl:flex-1"
          />
        </div>

        <div className="contents xl:col-span-4 xl:flex xl:flex-col xl:gap-5">
          <Card className="rise delay-3 order-1 xl:order-none">
            <CardHeader>
              <CardTitle>Prochaines sorties</CardTitle>
              <CardDescription>
                {upcomingCount > 0
                  ? `${upcomingCount} au planning · météo de Carnon`
                  : "Le planning et la météo du jour"}
              </CardDescription>
              <CardAction>
                <CardLink href="/bookings" label="Ouvrir le planning des réservations" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <UpcomingBookings bookings={upcoming} weather={weatherByDate} todayIso={todayIso} />
            </CardContent>
          </Card>

          <Card className="rise delay-4 order-4 xl:order-none xl:flex-1">
            <CardHeader>
              <CardTitle>Météo marine</CardTitle>
              <CardDescription>
                Carnon
                {weatherDays[0]?.water_temp_c != null ? (
                  <>
                    {" "}
                    · eau à <Num>{`${Math.round(weatherDays[0].water_temp_c)} °C`}</Num>
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeatherWidget days={weatherDays} booked={bookedByDate} todayIso={todayIso} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rise delay-5">
        <CardHeader>
          <CardTitle>Derniers mouvements</CardTitle>
          <CardDescription>Revenus et dépenses enregistrés</CardDescription>
          <CardAction>
            <CardLink href="/finances" label="Voir tous les mouvements dans Finance" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <RecentTransactions transactions={recentTransactions} columns={2} />
        </CardContent>
      </Card>
    </div>
  );
}
