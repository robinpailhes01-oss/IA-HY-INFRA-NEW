// L'architecture du tableau de bord — une seule source de vérité pour la barre
// latérale, la barre d'onglets mobile et les sous-onglets de section.
//
// Quatre espaces, pas quatorze liens. Chaque page existante appartient à un
// espace (et y apparaît comme sous-onglet) ou aux « Outils », repliés par
// défaut. Ajouter une page = l'ajouter ici, nulle part ailleurs.
//
// Pas d'icône dans ce fichier : les composants client choisissent les leurs
// à partir de `key` (une fonction ne traverse pas la frontière serveur/client).

export type SectionKey = "overview" | "agent" | "social" | "finance";

export type SubTab = { href: string; label: string };

export type Section = {
  key: SectionKey;
  label: string;
  /** Libellé court pour la barre d'onglets mobile. */
  short: string;
  href: string;
  /** Sur-titre affiché dans la barre latérale. */
  group: string;
  tabs: SubTab[];
};

export const SECTIONS: Section[] = [
  {
    key: "overview",
    label: "Vue d'ensemble",
    short: "Accueil",
    href: "/",
    group: "Pilotage",
    tabs: [],
  },
  {
    key: "agent",
    label: "Agent WhatsApp",
    short: "Agent",
    href: "/agent",
    group: "Agent IA",
    tabs: [
      { href: "/agent", label: "Pilotage" },
      { href: "/agent/conversations", label: "Conversations" },
      { href: "/leads", label: "Leads" },
      { href: "/resultats", label: "Résultats" },
    ],
  },
  {
    key: "social",
    label: "Réseaux sociaux",
    short: "Social",
    href: "/social",
    group: "Croissance",
    tabs: [
      { href: "/social", label: "Vue d'ensemble" },
      { href: "/analytics", label: "Audience du site" },
      { href: "/seo", label: "Visibilité SEO" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    short: "Finance",
    href: "/finances",
    group: "Gestion",
    tabs: [
      { href: "/finances", label: "Vue d'ensemble" },
      { href: "/bookings", label: "Réservations" },
      { href: "/reports", label: "Rapports" },
    ],
  },
];

export type ToolKey = "events" | "archives" | "jarvis" | "settings";

export const TOOLS: Array<{ key: ToolKey; href: string; label: string }> = [
  { key: "events", href: "/events", label: "Événements" },
  { key: "archives", href: "/archives", label: "Archives clients" },
  { key: "jarvis", href: "/jarvis", label: "Jarvis (voix)" },
  { key: "settings", href: "/settings", label: "Paramètres" },
];

export function matchesPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** L'espace auquel appartient une page (undefined pour les outils). */
export function sectionFor(pathname: string): Section | undefined {
  if (pathname === "/") return SECTIONS[0];
  return SECTIONS.find(
    (s) =>
      s.key !== "overview" &&
      (matchesPath(pathname, s.href) ||
        s.tabs.some((t) => matchesPath(pathname, t.href)) ||
        // L'ancienne page Marketing est absorbée par Réseaux sociaux.
        (s.key === "social" && matchesPath(pathname, "/marketing"))),
  );
}

/** Le sous-onglet actif : la correspondance la plus longue gagne
 *  (/agent/conversations ne doit pas allumer aussi /agent). */
export function activeTab(pathname: string, tabs: SubTab[]): string | undefined {
  return tabs
    .filter((t) => matchesPath(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
