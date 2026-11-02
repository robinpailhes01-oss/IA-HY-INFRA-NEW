import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  Check,
  ChevronDown,
  Flame,
  Hand,
  MessageCircle,
  TrendingDown,
  Wallet,
  Wind,
} from "lucide-react";

import { SignaturePanel } from "@/components/dashboard/signature-panel";
import { LeaAvatar } from "@/components/lea/lea-avatar";
import { AgentAsk } from "@/components/overview/agent-ask";
import { LeaLiveBadge } from "@/components/overview/lea-live-badge";
import { Num } from "@/components/ui/num";
import { formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";

// LE BRIEF DE LÉA — le panneau marine du cockpit, là où parle l'agent.
//
// Tout est composé ici, de façon DÉTERMINISTE, à partir des signaux calculés
// par la page : aucune phrase générée, aucun chiffre inventé. Même entrée →
// même brief. L'agent « parle » parce que la phrase est écrite comme il la
// dirait, pas parce qu'un modèle tourne à chaque affichage. La question libre,
// elle, part du compositeur en bas du panneau vers Léa elle-même (le widget
// global, /api/jarvis) : une seule conversation, une seule mémoire.
//
// Ordre des priorités : ce qui fait perdre un client d'abord (on l'a laissé
// sans réponse, Léa attend une décision), puis ce qui menace une sortie
// prévue (mer, confirmation), puis l'argent à aller chercher.

export type BriefSignals = {
  /** Clients actifs dont le dernier message WhatsApp attend notre réponse. */
  awaiting: number;
  /** Parmi eux, la demande datée la plus proche — pour la nommer. */
  awaitingFeatured: { offer: string | null; date: string } | null;
  /** Conversations que Léa a escaladées (needs_human_intervention). */
  takeover: number;
  /** Prospects actifs dont la date souhaitée tombe sous 7 jours. */
  imminentLeads: number;
  /** Réservations encore « en attente » qui partent sous 7 jours. */
  toConfirm: number;
  /** Premier jour réservé où la météo marine est déconseillée. */
  weatherRisk: { date: string; count: number; wind: number | null } | null;
  /** Soldes à encaisser le jour J sur les 10 prochains jours. */
  balancesSoon: { count: number; amount: number } | null;
  /** Réservations à venir dont l'acompte n'est pas versé. */
  depositsPending: number;
  /** Mois de charges couverts par la trésorerie (null = inconnu). */
  runwayMonths: number | null;
  /** Reste à encaisser sur les sorties à venir. */
  outstanding: number;
  nextOuting: {
    date: string;
    time: string | null;
    offer: string | null;
    customer: string;
    /** Note de weather_cache ce jour-là (ideal / acceptable / discouraged). */
    rating: string | null;
  } | null;
  todayIso: string;
};

type Tone = "danger" | "warning" | "calm";

type BriefAction = {
  key: string;
  tone: Tone;
  icon: React.ReactNode;
  title: React.ReactNode;
  detail: string;
  cta: string;
  href: string;
};

// Une phrase = une suite de morceaux : du texte, un passage mis en relief
// (italique ciel), un montant (qui passe par <Num>).
type Seg = string | { em: string } | { num: string };

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Midi UTC : le jour de la semaine ne bascule pas avec le fuseau du serveur. */
function day(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((day(toIso).getTime() - day(fromIso).getTime()) / 86_400_000);
}

/** « aujourd'hui », « demain », « jeudi », sinon « le 24 décembre ». */
function whenPhrase(iso: string, todayIso: string, withArticle = true): string {
  const diff = daysBetween(todayIso, iso);
  const d = day(iso);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff > 1 && diff < 7) return JOURS[d.getUTCDay()];
  return `${withArticle ? "le " : ""}${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/** « Nuit Insolite (avec sortie en mer) » → « Nuit Insolite » ; un nom
 *  générique (« Sortie privative 3h ») perd sa capitale en milieu de phrase,
 *  un nom de produit (« Nuit Prestige ») la garde. */
function offerName(raw: string | null): string | null {
  const clean = raw?.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (!clean) return null;
  return /^\S+\s+[A-ZÀ-Ý]/.test(clean) ? clean : clean.charAt(0).toLowerCase() + clean.slice(1);
}

function plural(n: number, one: string, many: string) {
  return n > 1 ? many : one;
}

function headline(s: BriefSignals): Seg[][] {
  const sentences: Seg[][] = [];

  // ── 1. Les gens ───────────────────────────────────────────────────
  if (s.awaiting > 0) {
    const first: Seg[] = [
      { em: `${s.awaiting} ${plural(s.awaiting, "client", "clients")}` },
      ` ${plural(s.awaiting, "attend", "attendent")} ta réponse`,
    ];
    const f = s.awaitingFeatured;
    if (f) {
      // « une Nuit Insolite » / « une sortie privative 3h » : nos offres sont
      // féminines. Un intitulé inattendu passe entre guillemets, une offre
      // inconnue devient simplement « une sortie ».
      const offer = offerName(f.offer);
      const what = !offer
        ? "une sortie"
        : /^(nuit|sortie|balade|croisi|soir|journ)/i.test(offer)
          ? `une ${offer}`
          : `une demande « ${offer} »`;
      const when = whenPhrase(f.date, s.todayIso);
      // Plusieurs clients : on nomme le plus pressé (« dont… »). Un seul :
      // la phrase dit directement ce qu'il veut.
      first.push(s.awaiting > 1 ? `, dont ${what} pour ${when}` : ` pour ${what} ${when}`);
    }
    first.push(".");
    sentences.push(first);
  } else if (s.takeover > 0) {
    sentences.push(["Léa te passe la main sur ", { em: `${s.takeover} ${plural(s.takeover, "conversation", "conversations")}` }, "."]);
  } else if (s.toConfirm > 0) {
    sentences.push([{ em: `${s.toConfirm} ${plural(s.toConfirm, "sortie", "sorties")}` }, " à confirmer d'ici sept jours."]);
  } else {
    // Neutre à dessein : d'autres points (météo, soldes) peuvent encore
    // figurer à droite — « tout est à jour » les contredirait.
    sentences.push([{ em: "Aucun client" }, " n'attend ta réponse."]);
  }

  // ── 2. L'argent ───────────────────────────────────────────────────
  const r = s.runwayMonths;
  if (r != null && Number.isFinite(r) && r > 0) {
    if (r >= 24) sentences.push(["Ta trésorerie couvre ", { em: "plus de deux ans" }, " de charges."]);
    else if (r >= 3) sentences.push(["Ta trésorerie couvre ", { em: `${Math.round(r)} mois` }, " de charges."]);
    else
      sentences.push([
        "Attention, la trésorerie ne couvre plus que ",
        { em: `${r.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois` },
        " de charges.",
      ]);
  } else if (s.outstanding > 0) {
    sentences.push(["Il reste ", { num: formatEur(s.outstanding) }, " à encaisser sur les sorties à venir."]);
  }

  return sentences;
}

function actions(s: BriefSignals): BriefAction[] {
  const out: BriefAction[] = [];

  if (s.awaiting > 0)
    out.push({
      key: "unanswered",
      tone: "danger",
      icon: <MessageCircle />,
      title: `${s.awaiting} ${plural(s.awaiting, "client sans réponse", "clients sans réponse")}`,
      detail: "Ils t'ont écrit sur WhatsApp",
      cta: "Répondre",
      href: "/leads?view=priority&bucket=unanswered",
    });

  if (s.takeover > 0)
    out.push({
      key: "takeover",
      tone: "warning",
      icon: <Hand />,
      title: `${s.takeover} ${plural(s.takeover, "conversation à reprendre", "conversations à reprendre")}`,
      detail: "Léa attend ta décision",
      cta: "Reprendre",
      href: "/leads?view=priority&bucket=takeover",
    });

  if (s.runwayMonths != null && s.runwayMonths > 0 && s.runwayMonths < 3)
    out.push({
      key: "runway",
      tone: "danger",
      icon: <TrendingDown />,
      title: "Trésorerie tendue",
      detail: `${s.runwayMonths.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois de charges couverts`,
      cta: "Finance",
      href: "/finances",
    });

  if (s.weatherRisk) {
    const w = s.weatherRisk;
    const when = whenPhrase(w.date, s.todayIso);
    out.push({
      key: "weather",
      tone: "warning",
      icon: <Wind />,
      title: `Mer déconseillée ${when}`,
      detail: `${w.count} ${plural(w.count, "sortie prévue", "sorties prévues")}${w.wind != null ? ` · vent ${Math.round(w.wind)} km/h` : ""}`,
      cta: "Planning",
      href: "/bookings",
    });
  }

  if (s.toConfirm > 0)
    out.push({
      key: "confirm",
      tone: "calm",
      icon: <CalendarCheck />,
      title: `${s.toConfirm} ${plural(s.toConfirm, "sortie à confirmer", "sorties à confirmer")}`,
      detail: "Départ sous 7 jours",
      cta: "Confirmer",
      href: "/bookings",
    });

  if (s.imminentLeads > 0)
    out.push({
      key: "imminent",
      tone: "calm",
      icon: <Flame />,
      title: `${s.imminentLeads} ${plural(s.imminentLeads, "prospect pour cette semaine", "prospects pour cette semaine")}`,
      detail: "Date souhaitée sous 7 jours",
      cta: "Voir",
      href: "/leads?view=priority&bucket=imminent",
    });

  if (s.balancesSoon)
    out.push({
      key: "balances",
      tone: "calm",
      icon: <Wallet />,
      title: (
        <>
          <Num>{formatEur(s.balancesSoon.amount)}</Num> de soldes à encaisser
        </>
      ),
      detail: `${s.balancesSoon.count} ${plural(s.balancesSoon.count, "sortie", "sorties")} d'ici 10 jours · ${plural(s.balancesSoon.count, "réglé", "réglés")} le jour J`,
      cta: "Planning",
      href: "/bookings",
    });

  if (s.depositsPending > 0)
    out.push({
      key: "deposits",
      tone: "calm",
      icon: <Banknote />,
      title: `${s.depositsPending} ${plural(s.depositsPending, "acompte en attente", "acomptes en attente")}`,
      detail: "Sorties à venir sans acompte",
      cta: "Relancer",
      href: "/bookings",
    });

  return out;
}

/** « 17:30:00 » → « 17 h 30 », « 10:00:00 » → « 10 h ». */
function heure(t: string): string {
  const [h, m] = t.split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
}

function supportLine(s: BriefSignals): React.ReactNode {
  const n = s.nextOuting;
  if (!n) return "Aucune sortie au planning pour l'instant — Léa continue de prospecter sur WhatsApp.";
  const diff = daysBetween(s.todayIso, n.date);
  const d = day(n.date);
  const when =
    diff === 0
      ? "aujourd'hui"
      : diff === 1
        ? "demain"
        : `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
  const offer = offerName(n.offer);
  // La mer de ce jour-là, quand elle change quelque chose : Léa croise le
  // planning et la météo pour que Robin n'ait pas à le faire.
  const sea =
    n.rating === "discouraged"
      ? ", mer déconseillée ce jour-là"
      : n.rating === "ideal"
        ? ", mer idéale annoncée"
        : "";
  return (
    <>
      Prochaine sortie {when}
      {n.time ? ` à ${heure(n.time)}` : ""}
      {offer ? ` — ${offer}` : ""}
      {n.customer ? ` pour ${n.customer}` : ""}
      {sea}.
    </>
  );
}

/** « de mardi », « de demain », « d'aujourd'hui », « du 24 décembre ». */
function deDay(iso: string, todayIso: string): string {
  const diff = daysBetween(todayIso, iso);
  const d = day(iso);
  if (diff === 0) return "d'aujourd'hui";
  if (diff === 1) return "de demain";
  if (diff > 1 && diff < 7) return `de ${JOURS[d.getUTCDay()]}`;
  return `du ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/** Les questions qu'on a envie de poser à Léa EN LISANT ce brief : la
 *  première suit le signal le plus urgent, les suivantes sont les classiques
 *  du matin. Trois au plus — une rangée, pas un menu. */
function suggestions(s: BriefSignals): string[] {
  const out: string[] = [];
  if (s.awaiting > 0 || s.takeover > 0) out.push("Qui dois-je rappeler en premier ?");
  if (s.weatherRisk)
    out.push(
      `On maintient ${plural(s.weatherRisk.count, "la sortie", "les sorties")} ${deDay(s.weatherRisk.date, s.todayIso)} ?`,
    );
  out.push("Combien j'ai encaissé ce mois-ci ?", "Quelles sorties cette semaine ?");
  return out.slice(0, 3);
}

const TONE: Record<Tone, string> = {
  danger: "bg-[rgba(224,77,85,0.2)] text-[#ffa4aa]",
  warning: "bg-[rgba(217,130,43,0.22)] text-[#f7c27f]",
  calm: "bg-[rgba(124,192,245,0.16)] text-[#a9d6fa]",
};

const MOBILE_VISIBLE = 3;

function ActionRow({ action: a }: { action: BriefAction }) {
  return (
    <Link
      href={a.href}
      className="group flex min-h-[58px] items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] py-2 pl-2 pr-2 outline-none transition-colors duration-200 hover:bg-white/[0.11] focus-visible:ring-4 focus-visible:ring-white/20"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-[17px] [&_svg]:stroke-[1.9]",
          TONE[a.tone],
        )}
      >
        {a.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.015em] text-white">{a.title}</span>
        <span className="block truncate text-[12.5px] text-[#9fb8d6]">{a.detail}</span>
      </span>
      <span className="hidden shrink-0 text-[12.5px] font-medium text-[#cfe2f7] sm:inline">{a.cta}</span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-navy shadow-[0_6px_14px_-8px_rgba(0,0,0,0.6)] transition-transform duration-200 [transition-timing-function:var(--ease-ios)] group-hover:translate-x-0.5">
        <ArrowUpRight className="size-4" />
      </span>
    </Link>
  );
}

export function LeaBrief({ signals, updatedAt }: { signals: BriefSignals; updatedAt: string }) {
  const sentences = headline(signals);
  const list = actions(signals).slice(0, 5);

  return (
    <SignaturePanel
      className="rise delay-1"
      eyebrow={
        <span className="inline-flex items-center gap-2.5">
          {/* Le même visage que la bulle flottante : c'est Léa qui parle ici,
              et c'est à elle que file la question du compositeur. */}
          <LeaAvatar ring={false} className="size-7 shrink-0" />
          Le brief de Léa
          {/* L'heure du brief, hors capitales (« 22 H 08 » se lit mal) ; sur
              téléphone, la pastille d'état à côté suffit à dire « en direct ». */}
          <span className="hidden font-medium normal-case tracking-normal text-[#7fa3c9] sm:inline">
            · {updatedAt}
          </span>
        </span>
      }
      action={<LeaLiveBadge />}
    >
      <h2 className="sr-only">Le brief de Léa</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 [grid-template-areas:'voice'_'actions'_'ask'] xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:gap-x-10 xl:gap-y-7 xl:[grid-template-areas:'voice_actions'_'ask_actions']">
        {/* La voix : une à deux phrases, pas plus. Le détail est à droite. */}
        <div className="[grid-area:voice]">
          <p className="t-panel max-w-[34rem] text-white [&_em]:text-[#9fd0f7]">
            {sentences.map((segs, i) => (
              <span key={i}>
                {i > 0 && " "}
                {segs.map((seg, j) =>
                  typeof seg === "string" ? (
                    <span key={j}>{seg}</span>
                  ) : "em" in seg ? (
                    <em key={j}>{seg.em}</em>
                  ) : (
                    <Num key={j} className="italic text-[#9fd0f7]">
                      {seg.num}
                    </Num>
                  ),
                )}
              </span>
            ))}
          </p>
          <p className="t-body mt-3.5 max-w-[34rem] text-[#a9c3e0]">{supportLine(signals)}</p>
        </div>

        {/* Les actions, déjà triées par urgence réelle. */}
        <div className="[grid-area:actions]">
          <p className="t-label mb-3 flex items-center justify-between text-[#9fb8d6]">
            <span>{list.length > 0 ? "À traiter, dans l'ordre" : "À traiter"}</span>
            {list.length > 0 && (
              <span className="pastille bg-white/[0.08] text-[#cfe2f7]">
                {list.length} {plural(list.length, "point", "points")}
              </span>
            )}
          </p>
          {list.length === 0 ? (
            <div className="flex items-center gap-3.5 rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgba(15,159,110,0.22)] text-[#7fe0b8]">
                <Check className="size-[18px]" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold tracking-[-0.015em] text-white">
                  Rien ne t&apos;attend
                </span>
                <span className="block text-[12.5px] leading-snug text-[#9fb8d6]">
                  Léa veille sur WhatsApp et te le dira ici dès qu&apos;un client a besoin de toi.
                </span>
              </span>
            </div>
          ) : (
            <>
              {/* Téléphone : les trois plus urgents d'abord, le reste replié.
                  Cinq rangées repoussaient les chiffres à deux écrans plus bas. */}
              <ul className="space-y-2">
                {list.map((a, i) => (
                  <li key={a.key} className={cn(i >= MOBILE_VISIBLE && "hidden sm:block")}>
                    <ActionRow action={a} />
                  </li>
                ))}
              </ul>
              {list.length > MOBILE_VISIBLE && (
                <details className="group sm:hidden">
                  <summary className="mt-1 flex h-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-[#cfe2f7] outline-none focus-visible:ring-4 focus-visible:ring-white/20 [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">
                      Voir {list.length - MOBILE_VISIBLE} {plural(list.length - MOBILE_VISIBLE, "autre point", "autres points")}
                    </span>
                    <span className="hidden group-open:inline">Replier</span>
                    <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <ul className="mt-1 space-y-2">
                    {list.slice(MOBILE_VISIBLE).map((a) => (
                      <li key={a.key}>
                        <ActionRow action={a} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        {/* Le compositeur : la question libre, posée là où on lit le brief. */}
        <div className="[grid-area:ask] xl:self-end">
          <AgentAsk suggestions={suggestions(signals)} />
        </div>
      </div>
    </SignaturePanel>
  );
}
