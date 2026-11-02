// Les référents du site, dits comme Robin les dit : « Instagram », pas
// « l.facebook.com ». Chaque nom d'hôte est rangé dans une famille — réseaux,
// recherche, IA, direct, autres sites — pour lire d'un coup d'œil QUI amène du
// monde, pas seulement d'où arrive le clic.
//
// Les IA passent en premier : gemini.google.com est une IA, pas Google
// Recherche. La liste des domaines IA reste celle de lib/analytics (une seule
// source de vérité pour le suivi GEO).

import { isAiReferrer } from "@/lib/analytics";

export type SourceGroup = "social" | "search" | "ai" | "direct" | "other";

/** Glyphe à dessiner : les quatre marques connues, sinon une icône générique. */
export type SourceGlyphKind = "instagram" | "facebook" | "tiktok" | "whatsapp" | "search" | "ai" | "direct" | "web";

export type SourceInfo = { name: string; group: SourceGroup; glyph: SourceGlyphKind };

const AI_NAMES: Array<[RegExp, string]> = [
  [/chatgpt|openai/, "ChatGPT"],
  [/perplexity/, "Perplexity"],
  [/gemini/, "Gemini"],
  [/claude/, "Claude"],
  [/copilot/, "Copilot"],
];

const KNOWN: Array<[RegExp, string, SourceGroup, SourceGlyphKind]> = [
  [/(^|\.)instagram\.com$/, "Instagram", "social", "instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.me$/, "Facebook", "social", "facebook"],
  [/(^|\.)tiktok\.com$/, "TikTok", "social", "tiktok"],
  [/(^|\.)wa\.me$|whatsapp/, "WhatsApp", "social", "whatsapp"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube", "social", "web"],
  [/(^|\.)pinterest\./, "Pinterest", "social", "web"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, "LinkedIn", "social", "web"],
  [/(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "X (Twitter)", "social", "web"],
  [/(^|\.)google\.[a-z.]+$/, "Google", "search", "search"],
  [/(^|\.)bing\.com$/, "Bing", "search", "search"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo", "search", "search"],
  [/(^|\.)qwant\.com$/, "Qwant", "search", "search"],
  [/(^|\.)ecosia\.org$/, "Ecosia", "search", "search"],
  [/(^|\.)yahoo\.[a-z.]+$/, "Yahoo", "search", "search"],
];

export function describeSource(hostname: string): SourceInfo {
  const h = hostname.trim().toLowerCase().replace(/^www\./, "");
  if (!h || h === "(direct)") return { name: "Direct / inconnu", group: "direct", glyph: "direct" };
  if (isAiReferrer(h) || isAiReferrer(hostname)) {
    const name = AI_NAMES.find(([re]) => re.test(h))?.[1] ?? h;
    return { name, group: "ai", glyph: "ai" };
  }
  for (const [re, name, group, glyph] of KNOWN) {
    if (re.test(h)) return { name, group, glyph };
  }
  return { name: h, group: "other", glyph: "web" };
}

export const GROUPS: Array<{ key: SourceGroup; label: string }> = [
  { key: "social", label: "Réseaux sociaux" },
  { key: "search", label: "Recherche" },
  { key: "ai", label: "IA" },
  { key: "direct", label: "Direct" },
  { key: "other", label: "Autres sites" },
];

/** « / » → « Accueil » ; le reste tel quel, c'est l'adresse que Robin connaît. */
export function pageName(path: string): string {
  if (!path || path === "/") return "Accueil";
  return path;
}
