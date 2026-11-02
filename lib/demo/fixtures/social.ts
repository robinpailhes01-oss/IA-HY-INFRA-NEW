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

// ═══════════════════════════════════════════════════════════════════════
// Audience du site (/analytics) et audits SEO (/seo).
//
// Générateur LOCAL, à graine propre : les fichiers de fixtures suivants
// (finances, agent, extra) puisent dans le hasard et le compteur d'id
// partagés de core.ts. En consommer davantage ici décalerait toutes leurs
// données — on garde donc ces lignes-ci totalement indépendantes.
// ═══════════════════════════════════════════════════════════════════════
function localRng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = localRng(19_510_607);
const rint = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
let localSeq = 0;
const localId = (prefix: string) => {
  localSeq += 1;
  return `${prefix}-0000-4000-8000-${localSeq.toString(16).padStart(12, "0")}`;
};

// site_daily_snapshots — un instantané par jour sur ~14 mois, avec la
// saisonnalité d'une activité nautique : creux l'hiver, pic en juillet-août.
const REFERRERS: Array<[string, number]> = [
  ["instagram.com", 0.26],
  ["google.com", 0.24],
  ["(direct)", 0.17],
  ["l.facebook.com", 0.06],
  ["tiktok.com", 0.07],
  ["wa.me", 0.05],
  ["chatgpt.com", 0.035],
  ["perplexity.ai", 0.012],
  ["bing.com", 0.02],
  ["gemini.google.com", 0.008],
];
const PAGES: Array<[string, number]> = [
  ["/", 0.42],
  ["/sorties-en-mer", 0.2],
  ["/nuit-insolite", 0.15],
  ["/reserver", 0.1],
  ["/carte-cadeau", 0.07],
  ["/avis", 0.04],
  ["/contact", 0.02],
];
const site_daily_snapshots: Row[] = [];
for (let ago = 420; ago >= 0; ago--) {
  const d = daysFromNow(-ago);
  const month = d.getUTCMonth(); // 0 = janvier
  // Courbe de saison : 0 en janvier, 1 fin juillet.
  const season = Math.max(0, Math.cos(((month + d.getUTCDate() / 31 - 6.8) / 12) * 2 * Math.PI));
  // La croissance d'une année sur l'autre : le travail sur les réseaux paie.
  const growth = 1 + (420 - ago) / 900;
  const visitors = Math.max(12, Math.round((38 + season * 210) * growth + rint(-14, 14)));
  const pageviews = Math.round(visitors * (2.3 + rnd() * 0.7));
  const top_referrers = REFERRERS.map(([hostname, share]) => {
    const v = Math.max(0, Math.round(visitors * share * (0.75 + rnd() * 0.5)));
    return { hostname, visitors: v, pageviews: Math.round(v * (2 + rnd())) };
  }).filter((r) => r.visitors > 0);
  const top_pages = PAGES.map(([path, share]) => {
    const v = Math.max(0, Math.round(visitors * share * (0.8 + rnd() * 0.4)));
    return { path, visitors: v, pageviews: Math.round(v * (1.3 + rnd() * 0.6)) };
  }).filter((p) => p.visitors > 0);
  site_daily_snapshots.push({ snapshot_date: iso(d), visitors, pageviews, top_referrers, top_pages });
}

// seo_audits — six passages de l'Auditeur, du site encore « coquille vide »
// (application JavaScript sans contenu lisible) à aujourd'hui.
const SEO_CHECKS: Array<{ key: string; label: string; why: string; severity: "critical" | "warning"; fixedAt: number; pass: string; fail: string }> = [
  { key: "https", label: "Connexion sécurisée (HTTPS)", why: "Sans cadenas, Google déclasse le site et les visiteurs voient un avertissement.", severity: "critical", fixedAt: 0, pass: "Le site est bien servi en HTTPS.", fail: "Le site répond en HTTP non sécurisé." },
  { key: "hsts", label: "Sécurité renforcée (HSTS)", why: "Force le navigateur à toujours utiliser la connexion sécurisée, même si on tape l'adresse sans https.", severity: "warning", fixedAt: 0, pass: "En-tête de sécurité présent.", fail: "En-tête de sécurité absent." },
  { key: "response_time", label: "Rapidité du serveur", why: "Au-delà d'une seconde et demie, Google pénalise et les visiteurs abandonnent.", severity: "warning", fixedAt: 0, pass: "Le serveur répond en 0.42 seconde en moyenne.", fail: "Le serveur répond en 1.84 seconde en moyenne." },
  { key: "robots_txt", label: "Fichier d'instructions aux robots", why: "C'est le fichier que tout moteur lit en premier pour savoir ce qu'il a le droit de visiter.", severity: "warning", fixedAt: 1, pass: "Le fichier robots.txt est bien accessible.", fail: "Aucun fichier robots.txt trouvé." },
  { key: "robots_allows", label: "Indexation autorisée", why: "Une seule ligne mal placée dans ce fichier peut rendre tout le site invisible sur Google.", severity: "critical", fixedAt: 1, pass: "Les moteurs sont autorisés à parcourir le site.", fail: "Impossible à vérifier sans robots.txt." },
  { key: "sitemap_xml", label: "Plan du site (sitemap)", why: "C'est la carte que vous donnez à Google : sans elle, il doit deviner quelles pages existent.", severity: "critical", fixedAt: 2, pass: "Plan du site trouvé, 7 page(s) déclarée(s).", fail: "Aucun plan du site accessible." },
  { key: "sitemap_declared", label: "Plan du site signalé aux robots", why: "Indiquer l'adresse du plan dans robots.txt accélère la découverte de vos pages.", severity: "warning", fixedAt: 2, pass: "Le plan du site est bien signalé.", fail: "Le plan du site n'est pas signalé dans robots.txt." },
  { key: "content_without_js", label: "Contenu lisible sans JavaScript", why: "Le contrôle le plus important : si le texte n'est pas dans la page envoyée, les moteurs et les IA ne voient qu'une page blanche.", severity: "critical", fixedAt: 3, pass: "4 812 caractères de texte directement lisibles.", fail: "Seulement 212 caractères lisibles : la page est vide tant que le JavaScript n'est pas exécuté." },
  { key: "ai_crawler", label: "Visibilité pour les robots d'IA", why: "ChatGPT et Perplexity n'exécutent pas le JavaScript : ce qu'ils reçoivent ici est tout ce qu'ils sauront de vous.", severity: "critical", fixedAt: 3, pass: "Les IA reçoivent 4 812 caractères de contenu.", fail: "Les IA ne reçoivent que 212 caractères : elles ne peuvent rien citer de votre site." },
  { key: "h1", label: "Titre principal sur chaque page", why: "C'est la première chose qu'un moteur lit pour comprendre le sujet de la page.", severity: "critical", fixedAt: 3, pass: "7 page(s) sur 7 ont un titre principal.", fail: "2 page(s) sur 7 ont un titre principal." },
  { key: "title_present", label: "Titre de page renseigné", why: "C'est la ligne bleue cliquable dans les résultats Google.", severity: "critical", fixedAt: 0, pass: "7 page(s) sur 7 ont un titre.", fail: "3 page(s) sur 7 ont un titre." },
  { key: "title_unique", label: "Un titre différent par page", why: "Si toutes vos pages portent le même titre, Google considère qu'il n'y en a qu'une seule et ignore les autres.", severity: "critical", fixedAt: 4, pass: "7 titres distincts pour 7 pages.", fail: "Seulement 1 titre(s) distinct(s) pour 7 pages : elles sont vues comme des doublons." },
  { key: "description_present", label: "Description de page renseignée", why: "C'est le petit texte gris sous le titre dans Google : il décide si on clique ou pas.", severity: "warning", fixedAt: 4, pass: "7 page(s) sur 7 ont une description.", fail: "1 page(s) sur 7 ont une description." },
  { key: "description_unique", label: "Une description différente par page", why: "Une description recopiée à l'identique n'apporte aucune information sur la page en question.", severity: "critical", fixedAt: 9, pass: "7 descriptions distinctes.", fail: "Seulement 2 description(s) distincte(s) pour 7 pages." },
  { key: "canonical", label: "Adresse de référence déclarée", why: "Évite que Google considère plusieurs adresses comme du contenu dupliqué.", severity: "warning", fixedAt: 9, pass: "7 page(s) sur 7 déclarent leur adresse de référence.", fail: "0 page(s) sur 7 déclarent leur adresse de référence." },
  { key: "lang", label: "Langue du site correctement déclarée", why: "Un site français déclaré en anglais est proposé aux mauvaises personnes dans les résultats.", severity: "warning", fixedAt: 2, pass: "Le site se déclare en « fr ».", fail: "Le site se déclare en « en »." },
  { key: "og_image", label: "Image affichée au partage du lien", why: "C'est l'image qui apparaît quand on envoie le lien sur WhatsApp ou Instagram.", severity: "warning", fixedAt: 9, pass: "Une image de partage personnalisée est définie.", fail: "L'image de partage est encore celle par défaut de l'outil de création du site." },
  { key: "structured_data", label: "Fiche d'identité structurée (Schema.org)", why: "Le format que Google et les IA lisent en priorité pour connaître vos tarifs, votre adresse et vos avis. C'est lui qui fait apparaître les étoiles dans les résultats.", severity: "critical", fixedAt: 5, pass: "3 page(s) déclarent des données structurées.", fail: "Aucune donnée structurée : ni tarifs, ni localisation, ni avis déclarés." },
  { key: "pages_reachable", label: "Toutes les pages répondent", why: "Une page en erreur est une porte fermée, pour un visiteur comme pour un moteur.", severity: "critical", fixedAt: 0, pass: "7 page(s) sur 7 répondent correctement.", fail: "6 page(s) sur 7 répondent correctement." },
];
const SEO_PATHS = ["/", "/sorties-en-mer", "/nuit-insolite", "/reserver", "/carte-cadeau", "/avis", "/contact"];
const seo_audits: Row[] = [];
[74, 61, 47, 33, 19, 6].forEach((ago, run) => {
  const checks = SEO_CHECKS.map((c) => {
    const pass = run >= c.fixedAt;
    return { key: c.key, label: c.label, why: c.why, severity: c.severity, status: pass ? "pass" : "fail", detail: pass ? c.pass : c.fail };
  });
  const passed = checks.filter((c) => c.status === "pass").length;
  const readable = run >= 3;
  const pages = SEO_PATHS.map((path, i) => ({
    url: `https://harmonie-yacht.fr${path}`,
    status: 200,
    bytes: readable ? 38_000 + i * 2_400 : 2_900,
    textLength: readable ? 4_812 - i * 380 : 212,
    title: run >= 4 ? `Harmonie Yacht — ${path === "/" ? "sorties en mer privatives à Carnon" : path.slice(1).replace(/-/g, " ")}` : "Harmonie Yacht",
    h1Count: readable || i < 2 ? 1 : 0,
  }));
  seo_audits.push({
    id: localId("5e0a0d17"),
    site_url: "https://harmonie-yacht.fr",
    run_at: new Date(daysFromNow(-ago).setUTCHours(7, 12, 0, 0)).toISOString(),
    score: Math.round((passed / checks.length) * 100),
    checks_passed: passed,
    checks_total: checks.length,
    critical_count: checks.filter((c) => c.status === "fail" && c.severity === "critical").length,
    warning_count: checks.filter((c) => c.status === "fail" && c.severity === "warning").length,
    checks,
    pages,
    duration_ms: rint(6_000, 14_000),
    error: null,
    created_at: daysFromNow(-ago).toISOString(),
  });
});

socialFixtures.site_daily_snapshots = site_daily_snapshots;
socialFixtures.seo_audits = seo_audits;
