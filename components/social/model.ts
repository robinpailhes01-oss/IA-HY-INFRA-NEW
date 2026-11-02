// Le vocabulaire de l'espace Réseaux sociaux : plateformes, formats, périodes,
// canaux d'acquisition. Aucune dépendance au navigateur ni au serveur — ces
// tables sont lues des deux côtés de la frontière.

// ── Plateformes et formats (content_marketing.channel) ─────────────────────

export type Platform = "instagram" | "tiktok" | "facebook" | "whatsapp";

export const PLATFORMS: Platform[] = ["instagram", "tiktok", "facebook", "whatsapp"];

/** Un format du carnet → la plateforme qui le publie. */
export const PLATFORM_OF: Record<string, Platform> = {
  instagram_reel: "instagram",
  instagram_post: "instagram",
  instagram_story: "instagram",
  tiktok: "tiktok",
  facebook: "facebook",
  whatsapp_status: "whatsapp",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp: "Statut WhatsApp",
};

/** Libellé court du format, tel qu'on le dit à voix haute. */
export const FORMAT_LABEL: Record<string, string> = {
  instagram_reel: "Reel",
  instagram_post: "Post Instagram",
  instagram_story: "Story",
  tiktok: "TikTok",
  facebook: "Post Facebook",
  whatsapp_status: "Statut WhatsApp",
};

// ── Statuts du carnet ──────────────────────────────────────────────────────

export type ContentStatus = "published" | "scheduled" | "in_progress" | "idea";

export const STATUS_LABEL: Record<string, string> = {
  published: "Publié",
  scheduled: "Programmé",
  in_progress: "En préparation",
  idea: "Idée",
};

// ── Périodes ───────────────────────────────────────────────────────────────

export type SocialPeriod = "30" | "90" | "365" | "all";

export const SOCIAL_PERIODS: Array<{ value: SocialPeriod; label: string; long: string }> = [
  { value: "30", label: "30 j", long: "30 derniers jours" },
  { value: "90", label: "90 j", long: "90 derniers jours" },
  { value: "365", label: "12 mois", long: "12 derniers mois" },
  { value: "all", label: "Tout", long: "depuis le début" },
];

export function parsePeriod(raw: string | string[] | undefined): SocialPeriod {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return SOCIAL_PERIODS.some((p) => p.value === v) ? (v as SocialPeriod) : "30";
}

// ── Canaux d'acquisition (bookings.source_channel, leads.source_channel) ───
// Repris tels quels de l'ancienne page Marketing : ce sont les règles que
// Robin connaît, elles ne changent pas avec le design.

export const PAID_CHANNELS = new Set(["instagram_ads", "tiktok_ads", "meta_ads", "google", "google_ads"]);

export const ORGANIC_CHANNELS = new Set([
  "instagram_organic",
  "tiktok_organic",
  "facebook_organic",
  "word_of_mouth",
  "google_organic",
  // Les IA génératives sont de l'acquisition organique : on ne paie pas pour y
  // apparaître, on y apparaît parce qu'on est cité. Les compter ici permet de
  // voir la contribution du travail GEO dans le total organique.
  "chatgpt",
  "perplexity",
  "ai_other",
]);

// Le site internet n'est PAS une source d'acquisition : tout le monde réserve
// via le site. On l'exclut donc de toutes les statistiques marketing.
export const EXCLUDED_CHANNELS = new Set(["website"]);

/** Les canaux qui comptent comme « réseaux sociaux » — payants ou non.
 *  WhatsApp n'en fait pas partie : c'est le canal de Léa, pas une source. */
export const SOCIAL_CHANNELS = new Set([
  "instagram_organic",
  "instagram_ads",
  "tiktok_organic",
  "tiktok_ads",
  "facebook_organic",
  "meta_ads",
]);

export type CanalCategory = "paid" | "organic" | "other";

export function canalCategory(channel: string | null): CanalCategory {
  if (!channel) return "other";
  if (PAID_CHANNELS.has(channel)) return "paid";
  if (ORGANIC_CHANNELS.has(channel)) return "organic";
  return "other";
}

/** Booking confirmé au sens marketing : la sortie a été vendue. */
export const CONFIRMED = new Set(["confirmed", "completed"]);

// ── Petits calculs ─────────────────────────────────────────────────────────

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Nombre décimal à la française, une décimale : 1,4. */
export function dec1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
}

export function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
}
