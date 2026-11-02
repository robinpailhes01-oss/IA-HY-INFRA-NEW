// CE QUE L'AGENT RETIENT — les leçons tirées du carnet de contenus.
//
// Tout est DÉTERMINISTE : mêmes publications → mêmes phrases. Aucune
// génération, aucun chiffre inventé ; l'agent « parle » parce que la phrase
// est écrite comme il la dirait. La fenêtre est fixe (90 jours) quelle que
// soit la période choisie : on veut ce qui marche EN CE MOMENT, et 30 jours
// d'hiver ne suffisent pas à départager deux jours de publication.

import {
  FORMAT_LABEL,
  PLATFORM_LABEL,
  PLATFORM_OF,
  PLATFORMS,
  type Platform,
} from "@/components/social/model";
import { addDays, hourLabel, weekdayMon } from "@/components/social/time";

export type InsightContent = {
  id: string;
  channel: string;
  title: string | null;
  status: string | null;
  publish_date: string | null;
  publish_time: string | null;
  views: number | null;
  leads_attributed: number | null;
};

export type PlatformInsight = {
  platform: Platform;
  label: string;
  /** Leads par publication, sur la fenêtre. */
  ratio: number;
  posts: number;
  /** Le format qui a le mieux marché sur cette plateforme. */
  format: string;
};

export type SocialInsights = {
  windowDays: number;
  analysed: number;
  totalLeads: number;
  bestPlatform: PlatformInsight | null;
  runnerUp: PlatformInsight | null;
  /** Meilleur jour (0 = lundi) et son gain de vues vs la moyenne. */
  bestDay: { day: number; lift: number } | null;
  /** Meilleure heure de publication et son gain. */
  bestHour: { label: string; lift: number } | null;
  /** Performance relative par jour de semaine (1 = moyenne), null si aucun post. */
  byWeekday: Array<number | null>;
  /** Nombre de publications derrière chaque jour : sous MIN_POSTS, on montre
   *  la barre mais pâle — un seul post ne prouve rien. */
  weekdayPosts: number[];
  minPosts: number;
  star: { title: string; leads: number; format: string } | null;
};

// Il faut au moins deux publications dans un groupe pour en tirer une leçon :
// un seul Reel qui a cartonné un mardi ne fait pas du mardi un bon jour.
const MIN_POSTS = 2;

export function computeInsights(content: InsightContent[], today: string, windowDays = 90): SocialInsights {
  const since = addDays(today, -(windowDays - 1));
  const recent = content.filter(
    (c) =>
      c.status === "published" &&
      c.publish_date &&
      c.publish_date >= since &&
      c.publish_date <= today &&
      PLATFORM_OF[c.channel],
  );

  // ── Plateforme : leads par publication ─────────────────────────────────
  const perPlatform: PlatformInsight[] = [];
  for (const platform of PLATFORMS) {
    const posts = recent.filter((c) => PLATFORM_OF[c.channel] === platform);
    if (posts.length < MIN_POSTS) continue;
    const leads = posts.reduce((s, c) => s + (c.leads_attributed ?? 0), 0);
    // Le format phare : celui qui a amené le plus de leads, à défaut de vues.
    const byFormat = new Map<string, { leads: number; views: number }>();
    for (const c of posts) {
      const f = byFormat.get(c.channel) ?? { leads: 0, views: 0 };
      f.leads += c.leads_attributed ?? 0;
      f.views += c.views ?? 0;
      byFormat.set(c.channel, f);
    }
    const format = [...byFormat.entries()].sort(
      (a, b) => b[1].leads - a[1].leads || b[1].views - a[1].views,
    )[0][0];
    perPlatform.push({
      platform,
      label: PLATFORM_LABEL[platform],
      ratio: leads / posts.length,
      posts: posts.length,
      format,
    });
  }
  perPlatform.sort((a, b) => b.ratio - a.ratio || b.posts - a.posts);
  const bestPlatform = perPlatform[0] && perPlatform[0].ratio > 0 ? perPlatform[0] : null;
  const runnerUp = bestPlatform ? (perPlatform[1] ?? null) : null;

  // ── Créneau : vues relatives à la moyenne du format ────────────────────
  // Un Reel fait dix fois plus de vues qu'une story : comparer des vues
  // brutes ferait gagner le jour où l'on poste des Reels. On rapporte donc
  // chaque publication à la moyenne de SON format (1 = dans la moyenne).
  const meanByFormat = new Map<string, number>();
  for (const f of new Set(recent.map((c) => c.channel))) {
    const withViews = recent.filter((c) => c.channel === f && (c.views ?? 0) > 0);
    if (withViews.length) {
      meanByFormat.set(f, withViews.reduce((s, c) => s + (c.views ?? 0), 0) / withViews.length);
    }
  }
  const scored = recent
    .filter((c) => (c.views ?? 0) > 0 && meanByFormat.get(c.channel))
    .map((c) => ({ c, score: (c.views ?? 0) / meanByFormat.get(c.channel)! }));

  const dayGroups: number[][] = Array.from({ length: 7 }, () => []);
  const hourGroups = new Map<string, number[]>();
  for (const { c, score } of scored) {
    dayGroups[weekdayMon(c.publish_date!)].push(score);
    const h = hourLabel(c.publish_time);
    if (h) hourGroups.set(h, [...(hourGroups.get(h) ?? []), score]);
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const byWeekday = dayGroups.map((g) => (g.length ? mean(g) : null));

  // Le meilleur groupe, à condition de faire nettement mieux que la moyenne
  // (+5 %) : un « meilleur » créneau dans la moyenne n'en est pas un.
  let bestDay: SocialInsights["bestDay"] = null;
  for (let day = 0; day < 7; day++) {
    const g = dayGroups[day];
    if (g.length < MIN_POSTS) continue;
    const lift = mean(g) - 1;
    if (lift >= 0.05 && (!bestDay || lift > bestDay.lift)) bestDay = { day, lift };
  }
  let bestHour: SocialInsights["bestHour"] = null;
  for (const [label, g] of hourGroups) {
    if (g.length < MIN_POSTS) continue;
    const lift = mean(g) - 1;
    if (lift >= 0.05 && (!bestHour || lift > bestHour.lift)) bestHour = { label, lift };
  }

  // ── Le contenu qui a fait venir des clients ────────────────────────────
  const starRow = [...recent]
    .filter((c) => (c.leads_attributed ?? 0) > 0)
    .sort((a, b) => (b.leads_attributed ?? 0) - (a.leads_attributed ?? 0) || (b.views ?? 0) - (a.views ?? 0))[0];

  return {
    windowDays,
    analysed: recent.length,
    totalLeads: recent.reduce((s, c) => s + (c.leads_attributed ?? 0), 0),
    bestPlatform,
    runnerUp,
    bestDay,
    bestHour,
    byWeekday,
    weekdayPosts: dayGroups.map((g) => g.length),
    minPosts: MIN_POSTS,
    star: starRow
      ? {
          title: starRow.title?.trim() || "Sans titre",
          leads: starRow.leads_attributed ?? 0,
          format: FORMAT_LABEL[starRow.channel] ?? starRow.channel,
        }
      : null,
  };
}

/** « deux fois », « trois fois »… pour comparer deux ratios à voix haute. */
export function timesWord(mult: number): string | null {
  if (mult < 1.9) return null;
  const n = Math.round(mult);
  const words = ["", "", "deux", "trois", "quatre", "cinq"];
  return `${words[n] ?? n} fois`;
}

/** Le format avec son article : « un Reel », « une story ». */
export function withArticle(channel: string): string {
  const map: Record<string, string> = {
    instagram_reel: "un Reel",
    instagram_post: "un post Instagram",
    instagram_story: "une story",
    tiktok: "un TikTok",
    facebook: "un post Facebook",
    whatsapp_status: "un statut WhatsApp",
  };
  return map[channel] ?? "un contenu";
}
