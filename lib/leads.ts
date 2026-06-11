import {
  AtSign,
  Camera,
  Globe,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

/** Shape commun d'un lead utilisé par le Kanban, la table et le détail. */
export type Lead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source_channel: string | null;
  source_status: string | null;
  interested_offer: string | null;
  occasion: string | null;
  party_size: number | null;
  desired_date: string | null;
  desired_time_slot: string | null;
  score: number | null;
  status: string | null;
  needs_human_intervention: boolean | null;
  last_interaction_at: string | null;
  last_followup_at: string | null;
  followup_count: number | null;
  ai_memo: string | null;
  notes: string | null;
  created_at: string | null;
  archived: boolean | null;
  whatsapp_name: string | null;
};

/** Colonnes de référence (= contrainte CHECK leads.status), dans l'ordre du pipeline. */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "quote_sent",
  "followed_up",
  "booked",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

type ColumnConfig = {
  status: LeadStatus;
  label: string;
  /** Teinte de fond très subtile de la colonne. */
  tint: string;
  /** Couleur d'accent du header (texte + point). */
  accent: string;
  dot: string;
};

export const LEAD_COLUMNS: ColumnConfig[] = [
  { status: "new", label: "Nouveau", tint: "bg-info/4", accent: "text-info", dot: "bg-info" },
  { status: "contacted", label: "Contacté", tint: "bg-primary/4", accent: "text-primary", dot: "bg-primary" },
  { status: "qualified", label: "Qualifié", tint: "bg-gold/6", accent: "text-gold", dot: "bg-gold" },
  { status: "quote_sent", label: "Devis envoyé", tint: "bg-warning/6", accent: "text-warning", dot: "bg-warning" },
  { status: "followed_up", label: "Relancé", tint: "bg-chart-2/5", accent: "text-chart-2", dot: "bg-chart-2" },
  { status: "booked", label: "Réservé", tint: "bg-success/6", accent: "text-success", dot: "bg-success" },
  { status: "lost", label: "Perdu", tint: "bg-destructive/4", accent: "text-destructive/80", dot: "bg-destructive/70" },
];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_COLUMNS.map((c) => [c.status, c.label]),
);

/** Statuts « actifs » où une relance > 48h devient pertinente. */
const ACTIVE_STATUSES = new Set<string>([
  "contacted",
  "qualified",
  "quote_sent",
  "followed_up",
]);

const FOLLOW_UP_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** Vrai si le lead est sur un statut actif et sans interaction depuis > 48h. */
export function needsFollowUp(lead: Lead, now: number): boolean {
  if (!lead.status || !ACTIVE_STATUSES.has(lead.status)) return false;
  const ref = lead.last_interaction_at ?? lead.created_at;
  if (!ref) return false;
  return now - new Date(ref).getTime() > FOLLOW_UP_THRESHOLD_MS;
}

/** Classe de couleur du badge de score (≥7 vert · 5-6 or · 3-4 orange · <3 rouge). */
export function scoreClasses(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 7) return "bg-success/12 text-success";
  if (score >= 5) return "bg-gold/15 text-gold";
  if (score >= 3) return "bg-warning/15 text-warning";
  return "bg-destructive/12 text-destructive";
}

type ChannelMeta = { label: string; Icon: LucideIcon; className: string };

const CHANNEL_META: Record<string, ChannelMeta> = {
  instagram_organic: { label: "Instagram", Icon: Camera, className: "bg-pink-500/12 text-pink-600" },
  instagram_ads: { label: "Instagram Ads", Icon: Camera, className: "bg-pink-500/12 text-pink-600" },
  tiktok_organic: { label: "TikTok", Icon: Video, className: "bg-foreground/8 text-foreground" },
  tiktok_ads: { label: "TikTok Ads", Icon: Video, className: "bg-foreground/8 text-foreground" },
  meta_ads: { label: "Meta Ads", Icon: Megaphone, className: "bg-info/12 text-info" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, className: "bg-success/12 text-success" },
  email: { label: "Email", Icon: Mail, className: "bg-info/12 text-info" },
  website: { label: "Site web", Icon: Globe, className: "bg-primary/10 text-primary" },
  phone: { label: "Téléphone", Icon: Phone, className: "bg-primary/10 text-primary" },
  word_of_mouth: { label: "Bouche à oreille", Icon: Users, className: "bg-gold/12 text-gold" },
  other: { label: "Autre", Icon: AtSign, className: "bg-muted text-muted-foreground" },
};

export function channelMeta(channel: string | null): ChannelMeta {
  return (
    CHANNEL_META[channel ?? ""] ?? {
      label: channel ?? "—",
      Icon: AtSign,
      className: "bg-muted text-muted-foreground",
    }
  );
}

export const SOURCE_STATUS_LABEL: Record<string, string> = {
  to_ask: "À demander",
  confirmed: "Confirmée",
  unknown: "Inconnue",
};

export function fullName(first: string | null, last: string | null, fallback?: string | null): string {
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined || fallback?.trim() || "Lead";
}

export function initials(first: string | null, last: string | null, fallback?: string | null): string {
  const a = first?.trim()?.[0] ?? "";
  const b = last?.trim()?.[0] ?? "";
  if (!a && !b && fallback?.trim()) {
    const parts = fallback.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (a + b).toUpperCase() || "?";
}

export type LeadFilters = {
  q: string;
  channels: string[];
  offer: string;
  minScore: number;
  followUpOnly: boolean;
};

export const EMPTY_FILTERS: LeadFilters = {
  q: "",
  channels: [],
  offer: "",
  minScore: 0,
  followUpOnly: false,
};

export function filtersActive(f: LeadFilters): boolean {
  return (
    f.q.trim() !== "" ||
    f.channels.length > 0 ||
    f.offer !== "" ||
    f.minScore > 0 ||
    f.followUpOnly
  );
}

export function filterLeads(leads: Lead[], f: LeadFilters, now: number): Lead[] {
  const q = f.q.trim().toLowerCase();
  return leads.filter((lead) => {
    if (q) {
      const haystack = [
        lead.first_name,
        lead.last_name,
        lead.email,
        lead.phone,
        lead.interested_offer,
        lead.occasion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (f.channels.length > 0 && !f.channels.includes(lead.source_channel ?? "")) {
      return false;
    }
    if (f.offer && lead.interested_offer !== f.offer) return false;
    if (f.minScore > 0 && (lead.score ?? 0) < f.minScore) return false;
    if (f.followUpOnly && !needsFollowUp(lead, now)) return false;
    return true;
  });
}

/** Libellé relatif court : « aujourd'hui », « hier », « il y a 3 j ». */
export function relativeDays(date: string | null, now: number): string {
  if (!date) return "—";
  const diff = now - new Date(date).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}
