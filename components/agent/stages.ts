import type { LeadStatus } from "@/lib/leads";

// La couleur d'une étape du pipeline, partagée par le Kanban, la table, la
// fiche lead et l'entonnoir du Pilotage.
//
// Le pipeline descend du ciel vers le large : plus un lead avance, plus son
// bleu est profond. Seules les deux issues sortent de la gamme — réservé en
// vert (le sens « gagné »), perdu en gris (c'est terminé, pas une alerte :
// le rouge est gardé pour ce qui demande une action).
export type StageTone = {
  label: string;
  /** Couleur pleine (point, barre). */
  color: string;
  /** Classes de la pastille : fond teinté + texte lisible sur blanc. */
  pill: string;
};

export const STAGE_TONE: Record<LeadStatus, StageTone> = {
  new: { label: "Nouveau", color: "#7cc0f5", pill: "bg-[rgba(124,192,245,0.2)] text-[#2b74b8]" },
  contacted: { label: "Contacté", color: "#56a0ec", pill: "bg-[rgba(86,160,236,0.14)] text-[#2a6cb5]" },
  qualified: { label: "Qualifié", color: "#2f7fe0", pill: "bg-[rgba(47,127,224,0.12)] text-ocean" },
  quote_sent: { label: "Devis envoyé", color: "#6d7cf2", pill: "bg-[rgba(109,124,242,0.13)] text-[#4f5ed8]" },
  followed_up: { label: "Relancé", color: "#1f5aa6", pill: "bg-[rgba(31,90,166,0.11)] text-[#1f5aa6]" },
  booked: { label: "Réservé", color: "#0f9f6e", pill: "bg-[rgba(15,159,110,0.11)] text-success" },
  lost: { label: "Perdu", color: "#8394ab", pill: "bg-[rgba(131,148,171,0.16)] text-ink-2" },
};

export function stageTone(status: string | null | undefined): StageTone {
  return (
    STAGE_TONE[(status ?? "") as LeadStatus] ?? {
      label: status ?? "—",
      color: "#8394ab",
      pill: "bg-[rgba(131,148,171,0.16)] text-ink-2",
    }
  );
}

/** Teinte du score (0–10) : la chaleur d'un lead, pas une note scolaire. */
export function scoreTone(score: number | null | undefined): { chip: string; bar: string } {
  if (score == null) return { chip: "bg-[rgba(11,37,69,0.06)] text-ink-3", bar: "#c5d2e2" };
  if (score >= 8) return { chip: "bg-[rgba(15,159,110,0.12)] text-success", bar: "#0f9f6e" };
  if (score >= 6) return { chip: "bg-[rgba(47,127,224,0.12)] text-ocean", bar: "#2f7fe0" };
  if (score >= 4) return { chip: "bg-[rgba(217,130,43,0.13)] text-warning", bar: "#d9822b" };
  return { chip: "bg-[rgba(11,37,69,0.06)] text-ink-2", bar: "#8394ab" };
}
