import { SOURCE_OPTIONS } from "@/lib/status";
import { channelMeta } from "@/lib/leads";

// Le libellé lisible d'un canal. lib/leads ne connaît que les canaux
// historiques (Instagram, WhatsApp…) et renvoyait la clé brute pour les
// autres — « chatgpt », « google_organic » apparaissaient tels quels. La
// liste de référence des sources (lib/status) les nomme tous.
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OPTIONS);
const EXTRA: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  autre: "Autre",
};

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return "—";
  const known = channelMeta(channel).label;
  if (known !== channel) return known;
  return SOURCE_LABEL[channel] ?? EXTRA[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}
