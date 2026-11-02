import Link from "next/link";
import { ArrowRight, MessagesSquare, Ship, Target, UserPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MotionCard } from "@/components/dashboard/motion-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Num } from "@/components/ui/num";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { formatEur, formatNumber } from "@/lib/format";
import { fullName, initials } from "@/lib/leads";
import { fetchAll } from "@/components/agent/fetch-all";
import { LeaLive } from "@/components/agent/pilotage/lea-live";
import { TakeoverList, type TakeoverItem } from "@/components/agent/pilotage/takeover-list";
import { PipelineBars } from "@/components/agent/pilotage/pipeline-bars";
import { ChannelTable, type ChannelRow } from "@/components/agent/pilotage/channel-table";
import {
  RecentConversations,
  type RecentConversation,
} from "@/components/agent/pilotage/recent-conversations";
import {
  dayKeyParis,
  formatDuration,
  initialsOf,
  lastDays,
  median,
  shortDayLabel,
  timeAgoLong,
  timeAgoShort,
} from "@/components/agent/format";

// ── Pilotage de Léa ────────────────────────────────────────────────────────
// Le poste de commandement de l'agent IA : ce qu'elle fait en ce moment, ce
// qu'elle a fait cette semaine, ce qu'elle attend de Robin. Tout est calculé
// ici, côté serveur, depuis les tables réelles — aucun chiffre écrit en dur.
//
// Sources :
// · wa_conversations / wa_messages : l'activité WhatsApp (30 derniers jours) ;
// · leads + lead_last_message : le pipeline et qui attend une réponse ;
// · conversations : le journal multicanal de Léa (performance par canal) ;
// · bookings (lead_id renseigné) + revenues : ce que Léa a fait réserver.

const DAY = 86_400_000;
// Les statuts comptés comme « qualifiés » — même définition qu'avant la
// refonte : un lead relancé n'est pas plus qualifié qu'un devis envoyé.
const QUALIFIED = new Set(["qualified", "quote_sent", "booked"]);

type WaConv = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  is_paused: boolean;
  last_message_at: string | null;
  lead_id: string | null;
  unread_count: number | null;
};
type WaMsg = {
  conversation_id: string | null;
  from_me: boolean;
  is_from_human: boolean;
  body: string;
  created_at: string | null;
};
type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  created_at: string | null;
  needs_human_intervention: boolean | null;
  archived: boolean | null;
  source_channel: string | null;
  interested_offer: string | null;
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
}

export default async function AgentPilotagePage() {
  const supabase = await createClient();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since7 = now - 7 * DAY;
  const since60 = now - 60 * DAY;

  const [conversations, messages, leads, lastMessages, agentLog, leadBookings, bookingRevenues] =
    await Promise.all([
      fetchAll<WaConv>((from, to) =>
        supabase
          .from("wa_conversations")
          .select("id, customer_phone, customer_name, is_paused, last_message_at, lead_id, unread_count")
          .order("last_message_at", { ascending: false })
          .range(from, to),
      ),
      fetchAll<WaMsg>((from, to) =>
        supabase
          .from("wa_messages")
          .select("conversation_id, from_me, is_from_human, body, created_at")
          .gte("created_at", since30)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAll<LeadRow>((from, to) =>
        supabase
          .from("leads")
          .select(
            "id, first_name, last_name, status, created_at, needs_human_intervention, archived, source_channel, interested_offer",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      // Qui a parlé en dernier dans chaque fil : c'est ce qui dit « il attend
      // notre réponse » (même règle que la cloche et la vue Priorité). Seules
      // les lignes où le client a parlé en dernier nous intéressent.
      fetchAll<{ lead_id: string | null; last_from_me: boolean | null; last_message_at: string | null }>(
        (from, to) =>
          supabase
            .from("lead_last_message")
            .select("lead_id, last_from_me, last_message_at")
            .eq("last_from_me", false)
            .order("lead_id", { ascending: true })
            .range(from, to),
      ),
      // Le journal multicanal grossit d'une ligne par échange, depuis le
      // début : paginé, sinon « Performance par canal » plafonnerait à 1 000.
      fetchAll<{ lead_id: string | null; channel: string | null }>((from, to) =>
        supabase
          .from("conversations")
          .select("lead_id, channel")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchAll<{ id: string; lead_id: string | null; status: string | null; created_at: string | null }>(
        (from, to) =>
          supabase
            .from("bookings")
            .select("id, lead_id, status, created_at")
            .not("lead_id", "is", null)
            .neq("status", "cancelled")
            .order("id", { ascending: true })
            .range(from, to),
      ),
      fetchAll<{ amount: number | null; booking_id: string | null }>((from, to) =>
        supabase
          .from("revenues")
          .select("amount, booking_id")
          .not("booking_id", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

  // ── Activité WhatsApp ────────────────────────────────────────────────
  const days = lastDays(30, now);
  const byDay = new Map(days.map((d) => [d, { lea: 0, client: 0, human: 0 }]));
  const active30 = new Set<string>();
  const active7 = new Set<string>();
  let lea7 = 0;
  let human7 = 0;
  let lea30 = 0;
  let client30 = 0;
  let human30 = 0;
  const lastByConv = new Map<string, WaMsg>();
  const threads = new Map<string, WaMsg[]>();

  for (const m of messages) {
    if (!m.created_at || !m.conversation_id) continue;
    const t = new Date(m.created_at).getTime();
    const bucket = byDay.get(dayKeyParis(t));
    active30.add(m.conversation_id);
    if (t >= since7) active7.add(m.conversation_id);
    if (!m.from_me) {
      client30 += 1;
      if (bucket) bucket.client += 1;
    } else if (m.is_from_human) {
      human30 += 1;
      if (bucket) bucket.human += 1;
      if (t >= since7) human7 += 1;
    } else {
      lea30 += 1;
      if (bucket) bucket.lea += 1;
      if (t >= since7) lea7 += 1;
    }
    lastByConv.set(m.conversation_id, m);
    const list = threads.get(m.conversation_id) ?? [];
    list.push(m);
    threads.set(m.conversation_id, list);
  }

  // Temps de réponse : du premier message client resté sans réponse au
  // premier message envoyé ensuite. On ne garde que les réponses de Léa —
  // c'est sa réactivité qu'on mesure, pas celle de Robin.
  const leaDelays: number[] = [];
  for (const list of threads.values()) {
    let waitingSince: number | null = null;
    for (const m of list) {
      const t = new Date(m.created_at!).getTime();
      if (!m.from_me) {
        if (waitingSince === null) waitingSince = t;
      } else if (waitingSince !== null) {
        if (!m.is_from_human) leaDelays.push(t - waitingSince);
        waitingSince = null;
      }
    }
  }
  const medianDelay = median(leaDelays);

  const activity: TrendPoint[] = days.map((d) => ({
    label: shortDayLabel(d),
    a: byDay.get(d)!.lea,
    b: byDay.get(d)!.client,
  }));

  // Six tranches de 5 jours pour les petites courbes des cartes KPI : sur 30
  // points quotidiens à quelques unités, la courbe ne serait que du bruit.
  const slice5 = (key: (d: string) => number) =>
    Array.from({ length: 6 }, (_, i) => days.slice(i * 5, i * 5 + 5).reduce((s, d) => s + key(d), 0));
  const convPerDay = new Map<string, Set<string>>();
  for (const m of messages) {
    if (!m.created_at || !m.conversation_id) continue;
    const k = dayKeyParis(m.created_at);
    const set = convPerDay.get(k) ?? new Set<string>();
    set.add(m.conversation_id);
    convPerDay.set(k, set);
  }
  const convTrend = slice5((d) => convPerDay.get(d)?.size ?? 0);

  // ── Leads ────────────────────────────────────────────────────────────
  const ts = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
  const leads30 = leads.filter((l) => ts(l.created_at) >= now - 30 * DAY).length;
  const leadsPrev30 = leads.filter((l) => ts(l.created_at) >= since60 && ts(l.created_at) < now - 30 * DAY).length;
  const leads7 = leads.filter((l) => ts(l.created_at) >= since7).length;
  const leadsByDay = new Map<string, number>();
  for (const l of leads) {
    if (ts(l.created_at) < now - 30 * DAY) continue;
    const k = dayKeyParis(l.created_at!);
    leadsByDay.set(k, (leadsByDay.get(k) ?? 0) + 1);
  }
  const leadTrend = slice5((d) => leadsByDay.get(d) ?? 0);
  const leadDelta =
    leadsPrev30 > 0
      ? {
          value: `${leads30 >= leadsPrev30 ? "+" : "−"}${Math.abs(pct(leads30 - leadsPrev30, leadsPrev30))} %`,
          positive: leads30 >= leadsPrev30,
        }
      : undefined;

  const pipeline = leads.filter((l) => !l.archived);
  const stageCounts: Record<string, number> = {};
  for (const l of pipeline) {
    if (l.status) stageCounts[l.status] = (stageCounts[l.status] ?? 0) + 1;
  }

  // ── Qui attend Robin ─────────────────────────────────────────────────
  const isActive = (l: LeadRow) => !l.archived && l.status !== "booked" && l.status !== "lost";
  const leadById = new Map(leads.map((l) => [l.id, l]));
  // Le fil WhatsApp de chaque lead (le plus récent, la liste étant triée).
  const convByLead = new Map<string, WaConv>();
  for (const c of conversations) {
    if (c.lead_id && !convByLead.has(c.lead_id)) convByLead.set(c.lead_id, c);
  }
  const awaiting = lastMessages
    .filter((r) => r.lead_id && r.last_from_me === false)
    .map((r) => ({ lead: leadById.get(r.lead_id!), at: r.last_message_at }))
    .filter((r): r is { lead: LeadRow; at: string | null } => Boolean(r.lead && isActive(r.lead)));
  const escalated = leads.filter((l) => isActive(l) && l.needs_human_intervention);

  const hrefFor = (l: LeadRow) => {
    const phone = convByLead.get(l.id)?.customer_phone;
    return phone ? `/agent/conversations?phone=${encodeURIComponent(phone)}` : `/leads?lead=${l.id}`;
  };
  const nameOf = (l: LeadRow) => fullName(l.first_name, l.last_name, convByLead.get(l.id)?.customer_name);
  const seen = new Set<string>();
  const takeover: TakeoverItem[] = [];
  for (const l of escalated) {
    seen.add(l.id);
    takeover.push({
      id: l.id,
      name: nameOf(l),
      initials: initials(l.first_name, l.last_name, nameOf(l)),
      channel: l.source_channel,
      reason: "takeover",
      since: "",
      detail: l.interested_offer,
      href: hrefFor(l),
    });
  }
  for (const { lead: l, at } of [...awaiting].sort((a, b) => ts(a.at) - ts(b.at))) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    takeover.push({
      id: l.id,
      name: nameOf(l),
      initials: initials(l.first_name, l.last_name, nameOf(l)),
      channel: l.source_channel,
      reason: "awaiting",
      since: at ? `a écrit ${timeAgoLong(at, now)}` : "attend une réponse",
      detail: l.interested_offer,
      href: hrefFor(l),
    });
  }
  const waitingTotal = takeover.length;

  // ── Performance par canal (journal multicanal) ───────────────────────
  type Agg = { conversations: number; leads: Set<string>; qualified: Set<string> };
  const perChannel = new Map<string, Agg>();
  const allLeads = new Set<string>();
  const allQualified = new Set<string>();
  let totalConversations = 0;
  for (const c of agentLog) {
    const ch = c.channel || "autre";
    const a = perChannel.get(ch) ?? { conversations: 0, leads: new Set<string>(), qualified: new Set<string>() };
    a.conversations += 1;
    totalConversations += 1;
    if (c.lead_id) {
      a.leads.add(c.lead_id);
      allLeads.add(c.lead_id);
      if (QUALIFIED.has(leadById.get(c.lead_id)?.status ?? "")) {
        a.qualified.add(c.lead_id);
        allQualified.add(c.lead_id);
      }
    }
    perChannel.set(ch, a);
  }
  const channelRows: ChannelRow[] = [...perChannel.entries()]
    .map(([channel, a]) => ({
      channel,
      conversations: a.conversations,
      leads: a.leads.size,
      qualified: a.qualified.size,
    }))
    .sort((a, b) => b.conversations - a.conversations);
  const channelTotals = {
    conversations: totalConversations,
    leads: allLeads.size,
    qualified: allQualified.size,
  };
  const qualificationRate = pct(allQualified.size, allLeads.size);

  // ── Réservations issues des leads ────────────────────────────────────
  // Depuis le début, comme le taux de qualification : sur 30 jours, une
  // activité saisonnière afficherait zéro tout l'hiver sans rien dire.
  // L'argent vient de la table revenues, jamais du montant de la réservation :
  // c'est la seule source du chiffre d'affaires (pas de double comptage).
  const leadBookingIds = new Set(leadBookings.map((b) => b.id));
  const cashed = bookingRevenues
    .filter((r) => r.booking_id && leadBookingIds.has(r.booking_id))
    .reduce((s, r) => s + (r.amount ?? 0), 0);

  // ── Fils récents ─────────────────────────────────────────────────────
  const recent: RecentConversation[] = conversations.slice(0, 5).map((c) => {
    const last = lastByConv.get(c.id);
    const prefix = last?.from_me ? (last.is_from_human ? "Toi : " : "Léa : ") : "";
    return {
      id: c.id,
      phone: c.customer_phone,
      name: c.customer_name ?? c.customer_phone,
      initials: initialsOf(c.customer_name, c.customer_phone),
      paused: c.is_paused,
      unread: c.unread_count ?? 0,
      ago: timeAgoShort(c.last_message_at, now),
      preview: last ? `${prefix}${last.body}` : null,
    };
  });

  // ── La phrase de Léa ─────────────────────────────────────────────────
  const LETTRES = ["D", "L", "M", "M", "J", "V", "S"];
  const week = lastDays(7, now).map((d) => ({
    key: d,
    letter: LETTRES[new Date(`${d}T12:00:00Z`).getUTCDay()],
    lea: byDay.get(d)?.lea ?? 0,
    human: byDay.get(d)?.human ?? 0,
  }));
  const replies7 = lea7 + human7;
  const leaShare7 = pct(lea7, replies7);
  const c7 = active7.size;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <PageHeader
        eyebrow="Agent WhatsApp · pilotage"
        title={
          <>
            Léa, <em>aux commandes</em>
          </>
        }
        description="Ce que ton agent fait en ce moment, ce qu'il a fait cette semaine — et ce qu'il attend de toi."
        actions={
          <>
            <Link
              href="/leads"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "hidden sm:inline-flex")}
            >
              Pipeline des leads
            </Link>
            <Link
              href="/agent/conversations"
              className={cn(buttonVariants({ size: "lg" }), "hidden sm:inline-flex")}
            >
              <MessagesSquare />
              Ouvrir les conversations
            </Link>
          </>
        }
      />

      {/* ── Léa parle · qui attend ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={0} lift={false} className="lg:col-span-7">
          <SignaturePanel className="flex h-full flex-col [&>div]:flex [&>div]:flex-1 [&>div]:flex-col">
            <LeaLive />

            <p className="t-eyebrow mt-7 text-[#9fc6ee]">Ces 7 derniers jours</p>
            <p className="t-panel mt-2.5 max-w-[36rem] text-white">
              {c7 === 0 ? (
                <>Semaine calme : aucune conversation. Léa veille et répondra au premier message.</>
              ) : (
                <>
                  Léa a tenu <Num className="text-[#9fd0f7]">{formatNumber(c7)}</Num>{" "}
                  {plural(c7, "conversation", "conversations")} et créé{" "}
                  <Num className="text-[#9fd0f7]">{formatNumber(leads7)}</Num> {plural(leads7, "lead", "leads")}.{" "}
                  {waitingTotal > 0 ? (
                    <>
                      <em className="text-[#f6c784]">
                        {waitingTotal} {plural(waitingTotal, "client t'attend", "clients t'attendent")}.
                      </em>
                    </>
                  ) : (
                    <em className="text-[#8fe3b4]">Personne ne t&apos;attend.</em>
                  )}
                </>
              )}
            </p>

            <WeekBars days={week} />

            {/* Sous-grille : libellés, chiffres et légendes sur trois rangées
                communes — un libellé sur deux lignes ne décale plus son chiffre. */}
            <dl className="mt-auto grid grid-cols-3 grid-rows-[auto_auto_auto] gap-x-3 border-t border-white/10 pt-5 sm:gap-x-6">
              <div className="row-span-3 grid min-w-0 grid-rows-subgrid">
                <dt className="t-label self-end text-[#9fbfe2]">Réponse médiane</dt>
                <dd className="n-kpi mt-1.5 text-white">
                  {medianDelay === null ? "—" : <Num>{formatDuration(medianDelay)}</Num>}
                </dd>
              </div>
              <div className="row-span-3 grid min-w-0 grid-rows-subgrid">
                <dt className="t-label self-end text-[#9fbfe2]">Réponses de Léa</dt>
                <dd className="n-kpi mt-1.5 text-white">
                  {replies7 === 0 ? "—" : <Num>{`${leaShare7}\u00a0%`}</Num>}
                </dd>
                {replies7 > 0 && (
                  <dd aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/12">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#7cc0f5,#2f7fe0)]"
                      style={{ width: `${leaShare7}%` }}
                    />
                  </dd>
                )}
              </div>
              <div className="row-span-3 grid min-w-0 grid-rows-subgrid">
                <dt className="t-label self-end text-[#9fbfe2]">Messages envoyés</dt>
                <dd className="n-kpi mt-1.5 text-white">
                  <Num>{formatNumber(replies7)}</Num>
                </dd>
                <dd className="mt-1 truncate text-[11.5px] text-[#9fbfe2]">
                  {formatNumber(lea7)} Léa · {formatNumber(human7)} toi
                </dd>
              </div>
            </dl>
          </SignaturePanel>
        </MotionCard>

        <MotionCard index={1} lift={false} className="lg:col-span-5">
          <TakeoverList items={takeover.slice(0, 5)} total={waitingTotal} />
        </MotionCard>
      </div>

      {/* ── Chiffres clés ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        <KpiCard
          label="Conversations"
          value={active30.size}
          icon={<MessagesSquare />}
          accent="ocean"
          trend={convTrend}
          hint="fils actifs · 30 jours"
          primary
          index={2}
        />
        <KpiCard
          label="Leads générés"
          value={leads30}
          icon={<UserPlus />}
          accent="indigo"
          trend={leadTrend}
          delta={leadDelta}
          hint={leadDelta ? "vs 30 j précédents" : "30 derniers jours"}
          index={3}
        />
        <KpiCard
          label="Qualification"
          value={qualificationRate}
          suffix="%"
          icon={<Target />}
          accent="sky"
          hint={`${formatNumber(allQualified.size)} sur ${formatNumber(allLeads.size)} leads suivis`}
          index={4}
        />
        <KpiCard
          label="Réservations via Léa"
          value={leadBookings.length}
          icon={<Ship />}
          accent="aqua"
          hint={`${formatEur(cashed)} encaissés · depuis le début`}
          index={5}
        />
      </div>

      {/* ── Activité · pipeline ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={6} lift={false} className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Activité WhatsApp</CardTitle>
              <CardDescription>Messages par jour, sur les 30 derniers jours</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Deux séries seulement (Léa, clients) : tes propres réponses ne
                  sont pas tracées — trop rares pour faire une courbe — mais
                  comptées à part, sans pastille de couleur pour ne pas laisser
                  croire à une troisième ligne. */}
              <div className="flex flex-wrap items-center gap-2">
                <Legend color="#2f7fe0" label="Léa" value={lea30} />
                <Legend color="#9fd0f7" label="Clients" value={client30} />
                {human30 > 0 && (
                  <span className="ml-1 text-[12.5px] text-ink-3">
                    + <Num className="n-inline text-ink-2">{formatNumber(human30)}</Num>{" "}
                    {plural(human30, "réponse", "réponses")} de toi
                  </span>
                )}
              </div>
              {lea30 + client30 === 0 ? (
                <p className="vitre-inset grid h-[290px] place-items-center rounded-[20px] px-6 text-center text-[13px] text-ink-2">
                  Aucun message WhatsApp ces 30 derniers jours.
                </p>
              ) : (
                <TrendChart data={activity} a={{ name: "Léa" }} b={{ name: "Clients" }} height={290} />
              )}
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard index={7} lift={false} className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Où en sont tes leads</CardTitle>
              <CardDescription>
                {formatNumber(pipeline.length)} leads dans le pipeline ·{" "}
                {pct(stageCounts.booked ?? 0, pipeline.length)} % réservés
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <PipelineBars counts={stageCounts} />
              <Link
                href="/leads?view=kanban"
                className="mt-4 inline-flex h-10 items-center gap-1.5 self-start rounded-full bg-white/75 px-4 text-[13px] font-medium text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white"
              >
                Ouvrir le Kanban
                <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </MotionCard>
      </div>

      {/* ── Canaux · fils récents ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <MotionCard index={8} lift={false} className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Performance par canal</CardTitle>
              <CardDescription>
                Depuis le début · conversations de Léa, leads suivis et part qualifiée
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChannelTable rows={channelRows} totals={channelTotals} />
            </CardContent>
          </Card>
        </MotionCard>

        <MotionCard index={9} lift={false} className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Derniers échanges</CardTitle>
              <CardDescription>Les fils WhatsApp les plus récents</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <RecentConversations items={recent} />
              <Link
                href="/agent/conversations"
                className="mt-3 inline-flex h-10 items-center gap-1.5 self-start rounded-full bg-white/75 px-4 text-[13px] font-medium text-foreground shadow-[var(--shadow-glass)] transition-colors hover:bg-white"
              >
                Toutes les conversations
                <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </MotionCard>
      </div>
    </div>
  );
}

/** Les réponses envoyées jour par jour : la part de Léa en ciel, la tienne en blanc. */
function WeekBars({ days }: { days: Array<{ key: string; letter: string; lea: number; human: number }> }) {
  const max = Math.max(1, ...days.map((d) => d.lea + d.human));
  const H = 56;
  return (
    <div className="mb-6 mt-6">
      {/* La légende est visible, pas seulement au survol : le blanc en haut
          de colonne (tes réponses) ne se devine pas sur téléphone. */}
      <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#8fb2d8]">
        <span>Réponses envoyées, jour par jour</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#7cc0f5]" aria-hidden />
          Léa
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white/85" aria-hidden />
          toi
        </span>
      </p>
      <div className="flex items-end gap-2.5 sm:gap-4">
        {days.map((d, i) => {
          const total = d.lea + d.human;
          const h = total === 0 ? 4 : Math.max(8, Math.round((total / max) * H));
          const humanH = total === 0 ? 0 : Math.round((d.human / total) * h);
          const today = i === days.length - 1;
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-semibold tabular-nums text-[#bcd6f2]">{total || ""}</span>
              <div className="flex w-full max-w-[22px] items-end" style={{ height: H }} title={`${total} réponse${total > 1 ? "s" : ""}`}>
                <div className="flex w-full flex-col overflow-hidden rounded-[7px]" style={{ height: h }}>
                  {humanH > 0 && <div className="w-full shrink-0 bg-white/85" style={{ height: humanH }} />}
                  <div
                    className={
                      total === 0
                        ? "w-full flex-1 bg-white/15"
                        : "w-full flex-1 bg-[linear-gradient(180deg,#a6d5fa,#3f8ae4)]"
                    }
                  />
                </div>
              </div>
              <span className={today ? "text-[11px] font-semibold text-white" : "text-[11px] font-medium text-[#8fb2d8]"}>
                {d.letter}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/90 bg-white/60 px-3 text-[12.5px] shadow-[inset_0_1px_0_#fff]">
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="text-ink-2">{label}</span>
      <Num className="n-inline text-foreground">{formatNumber(value)}</Num>
    </span>
  );
}
