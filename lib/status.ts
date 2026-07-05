export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

type Config = { label: string; variant: BadgeVariant };

const LEAD_STATUS: Record<string, Config> = {
  new: { label: "Nouveau", variant: "default" },
  contacted: { label: "Contacté", variant: "secondary" },
  qualified: { label: "Qualifié", variant: "secondary" },
  quote_sent: { label: "Devis envoyé", variant: "secondary" },
  followed_up: { label: "Relancé", variant: "secondary" },
  booked: { label: "Réservé", variant: "outline" },
  lost: { label: "Perdu", variant: "destructive" },
};

const BOOKING_STATUS: Record<string, Config> = {
  confirmed: { label: "Confirmée", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  completed: { label: "Terminée", variant: "outline" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

export const SOURCE_OPTIONS: [string, string][] = [
  ["instagram_organic", "Instagram"],
  ["instagram_ads", "Instagram Ads"],
  ["tiktok_organic", "TikTok"],
  ["tiktok_ads", "TikTok Ads"],
  ["meta_ads", "Meta Ads"],
  ["google_ads", "Google Ads"],
  ["google_organic", "Google (recherche)"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["website", "Site web"],
  ["phone", "Téléphone"],
  ["word_of_mouth", "Bouche à oreille"],
  ["other", "Autre"],
  ["unknown", "Je ne sais pas"],
];

const SOURCE_CHANNEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);

function fallback(value: string | null): Config {
  return { label: value ?? "—", variant: "outline" };
}

export function leadStatusBadge(status: string | null): Config {
  return LEAD_STATUS[status ?? ""] ?? fallback(status);
}

export function bookingStatusBadge(status: string | null): Config {
  return BOOKING_STATUS[status ?? ""] ?? fallback(status);
}

export function sourceChannelLabel(channel: string | null): string {
  return SOURCE_CHANNEL[channel ?? ""] ?? channel ?? "—";
}
