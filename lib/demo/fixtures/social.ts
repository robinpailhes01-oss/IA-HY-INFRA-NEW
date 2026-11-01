/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures de l'espace Réseaux sociaux : contenus publiés et programmés,
// audience du site par source. Complète lib/demo/fixtures/core.ts.
import { demo } from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;
const { int, pick, chance, uid, iso, daysFromNow } = demo;

const TITLES = [
  "Coucher de soleil sur la Grande-Motte",
  "Une demande en mariage à bord 💍",
  "EVJF : la journée parfaite en mer",
  "Plongeon à la Maguelone",
  "Nuit Insolite : réveil sur l'eau",
  "Les coulisses : préparation du bateau",
  "Dauphins au large de Carnon 🐬",
  "Apéro au mouillage",
  "Avis client : « inoubliable »",
  "Noël à bord : la Nuit Prestige",
  "Le matin, la mer est à vous (−15 %)",
  "Skipper Robin répond à vos questions",
];
const CHANNELS = ["instagram_reel", "instagram_reel", "instagram_post", "instagram_story", "tiktok", "tiktok", "facebook", "whatsapp_status"];

const content_marketing: Row[] = [];
for (let i = 0; i < 30; i++) {
  const ago = int(1, 110);
  const channel = CHANNELS[i % CHANNELS.length];
  const isVideo = channel === "instagram_reel" || channel === "tiktok";
  const views = isVideo ? int(1800, 46000) : int(400, 5200);
  content_marketing.push({
    id: uid("c0e70000"),
    channel,
    content_type: isVideo ? "video" : "image",
    title: TITLES[i % TITLES.length],
    description: null,
    status: "published",
    publish_date: iso(daysFromNow(-ago)),
    publish_time: pick(["09:00", "12:30", "18:00", "19:30"]),
    views,
    likes: Math.round(views * (0.04 + demo.rand() * 0.05)),
    comments: int(4, 160),
    shares: int(2, 340),
    leads_attributed: chance(0.6) ? int(0, 7) : 0,
    url: null,
    notes: null,
    created_by: null,
    created_at: daysFromNow(-ago - 2).toISOString(),
    updated_at: null,
  });
}
// À venir : le calendrier éditorial.
[
  [1, "instagram_reel", "scheduled", "Nuit Insolite : réveil sur l'eau"],
  [3, "tiktok", "scheduled", "Skipper Robin répond à vos questions"],
  [6, "instagram_post", "in_progress", "Cartes cadeaux de Noël 🎁"],
  [9, "instagram_reel", "in_progress", "Noël à bord : la Nuit Prestige"],
  [14, "facebook", "idea", "Rétrospective de la saison"],
  [20, "tiktok", "idea", "Les 3 plus beaux mouillages de la côte"],
].forEach(([ahead, channel, status, title]) => {
  content_marketing.push({
    id: uid("c0e70000"),
    channel,
    content_type: String(channel).includes("reel") || channel === "tiktok" ? "video" : "image",
    title,
    description: null,
    status,
    publish_date: iso(daysFromNow(Number(ahead))),
    publish_time: "18:00",
    views: null,
    likes: null,
    comments: null,
    shares: null,
    leads_attributed: null,
    url: null,
    notes: null,
    created_by: null,
    created_at: daysFromNow(-1).toISOString(),
    updated_at: null,
  });
});

// Audience du site par jour et par source (vues site_traffic_*).
const SOURCES: Array<[string, string, number]> = [
  ["Instagram", "social", 0.31],
  ["Google", "search", 0.27],
  ["Direct", "direct", 0.18],
  ["TikTok", "social", 0.08],
  ["WhatsApp", "social", 0.06],
  ["Facebook", "social", 0.04],
  ["ChatGPT", "referral", 0.03],
  ["Meta Ads", "paid", 0.03],
];
const site_traffic_daily: Row[] = [];
const site_traffic_by_source: Row[] = [];
const site_traffic_by_page: Row[] = [];
for (let ago = 59; ago >= 0; ago--) {
  const day = iso(daysFromNow(-ago));
  const visitors = Math.round(70 + (60 - ago) * 0.6 + Math.sin(ago / 3) * 18 + int(-10, 10));
  site_traffic_daily.push({ day, visitors, pageviews: Math.round(visitors * 2.6) });
  for (const [label, group, share] of SOURCES) {
    const v = Math.max(0, Math.round(visitors * share + int(-3, 3)));
    site_traffic_by_source.push({ day, source_label: label, source_group: group, visitors: v, pageviews: Math.round(v * 2.4) });
  }
  for (const [path, share] of [["/", 0.45], ["/sorties-en-mer", 0.22], ["/nuit-insolite", 0.14], ["/reserver", 0.11], ["/carte-cadeau", 0.08]] as const) {
    const v = Math.round(visitors * share);
    site_traffic_by_page.push({ day, path, visitors: v, pageviews: Math.round(v * 1.7) });
  }
}

export const socialFixtures: Record<string, Row[]> = {
  content_marketing,
  site_traffic_daily,
  site_traffic_by_source,
  site_traffic_by_page,
};
