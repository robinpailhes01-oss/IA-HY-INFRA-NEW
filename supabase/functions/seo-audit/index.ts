// Edge Function : seo-audit — l'agent "Auditeur technique" de l'équipe SEO/GEO.
//
// Rejoue à la demande (ou par cron) la batterie de contrôles techniques sur le
// site public, et enregistre le résultat dans `seo_audits` pour construire un
// historique. Aucun outil payant : tout est mesuré en interrogeant directement
// le site, exactement comme le ferait un robot de moteur de recherche.
//
// Principe directeur : chaque contrôle doit être explicable en une phrase à
// quelqu'un qui n'y connaît rien. D'où le champ `why` sur chaque contrôle —
// c'est lui qui est affiché dans le tableau de bord, pas le jargon technique.
//
// Le score est un simple ratio contrôles conformes / contrôles totaux. Pas de
// pondération opaque : si Robin doit pouvoir partager la page, le chiffre doit
// être reproductible et défendable.
//
// Secrets attendus : SEO_SITE_URL (défaut harmonie-yacht.fr), SEO_AUDIT_SECRET
// (optionnel — protège l'appel), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_SITE = "https://harmonie-yacht.fr";
// Pages auditées par défaut. Le site étant une application JavaScript, il n'y a
// aucun lien à extraire du HTML servi — on ne peut pas découvrir les pages en
// crawlant, il faut donc les lister (ou les lire dans le sitemap s'il existe).
const DEFAULT_PATHS = ["/", "/sorties-en-mer", "/nuits-insolites", "/offres-speciales", "/galerie"];

const UA_BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const UA_GPTBOT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";

type Severity = "critical" | "warning";
type Check = {
  key: string;
  label: string;
  why: string;
  severity: Severity;
  status: "pass" | "fail";
  detail: string;
};

type PageInfo = {
  url: string;
  status: number;
  bytes: number;
  textLength: number;
  title: string | null;
  description: string | null;
  h1Count: number;
  jsonLd: number;
  canonical: string | null;
  lang: string | null;
  ogImage: string | null;
  ms: number;
};

// ── Extraction HTML (regex volontairement simples : on lit du HTML servi brut,
// pas un DOM rendu — inutile d'embarquer un parseur complet). ──────────────

function attr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function visibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

async function fetchPage(url: string, ua: string): Promise<PageInfo> {
  const started = Date.now();
  const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "follow" });
  const html = await res.text();
  const ms = Date.now() - started;

  return {
    url,
    status: res.status,
    bytes: new TextEncoder().encode(html).length,
    textLength: visibleTextLength(html),
    title: attr(html, /<title[^>]*>([^<]*)<\/title>/i),
    description: attr(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i),
    h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
    jsonLd: (html.match(/application\/ld\+json/gi) ?? []).length,
    canonical: attr(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i),
    lang: attr(html, /<html[^>]*\slang=["']([^"']*)["']/i),
    ogImage: attr(html, /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i),
    ms,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }

  const secret = Deno.env.get("SEO_AUDIT_SECRET");
  if (secret && req.headers.get("x-audit-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const started = Date.now();
  const site = (Deno.env.get("SEO_SITE_URL") ?? DEFAULT_SITE).replace(/\/$/, "");
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  try {
    // ── Pages ────────────────────────────────────────────────────────────
    const pages: PageInfo[] = [];
    for (const path of DEFAULT_PATHS) {
      try {
        pages.push(await fetchPage(site + path, UA_BROWSER));
      } catch (e) {
        pages.push({
          url: site + path, status: 0, bytes: 0, textLength: 0, title: null,
          description: null, h1Count: 0, jsonLd: 0, canonical: null, lang: null,
          ogImage: null, ms: 0,
        });
        console.error(`fetch ${path}`, e);
      }
    }
    const home = pages[0];
    const ok = pages.filter((p) => p.status === 200);

    // ── Transport / sécurité ─────────────────────────────────────────────
    const headRes = await fetch(site, { headers: { "user-agent": UA_BROWSER }, redirect: "follow" });
    add({
      key: "https",
      label: "Connexion sécurisée (HTTPS)",
      why: "Sans cadenas, Google déclasse le site et les visiteurs voient un avertissement.",
      severity: "critical",
      status: headRes.url.startsWith("https://") ? "pass" : "fail",
      detail: headRes.url.startsWith("https://") ? "Le site est bien servi en HTTPS." : "Le site répond en HTTP non sécurisé.",
    });
    const hsts = headRes.headers.get("strict-transport-security");
    add({
      key: "hsts",
      label: "Sécurité renforcée (HSTS)",
      why: "Force le navigateur à toujours utiliser la connexion sécurisée, même si on tape l'adresse sans https.",
      severity: "warning",
      status: hsts ? "pass" : "fail",
      detail: hsts ? "En-tête de sécurité présent." : "En-tête de sécurité absent.",
    });

    const avgMs = ok.length ? Math.round(ok.reduce((s, p) => s + p.ms, 0) / ok.length) : 0;
    add({
      key: "response_time",
      label: "Rapidité du serveur",
      why: "Au-delà d'une seconde et demie, Google pénalise et les visiteurs abandonnent.",
      severity: "warning",
      status: avgMs > 0 && avgMs < 1500 ? "pass" : "fail",
      detail: avgMs ? `Le serveur répond en ${(avgMs / 1000).toFixed(2)} seconde en moyenne.` : "Temps de réponse non mesurable.",
    });

    // ── robots.txt & sitemap ─────────────────────────────────────────────
    let robotsTxt = "";
    let robotsOk = false;
    try {
      const r = await fetch(`${site}/robots.txt`, { headers: { "user-agent": UA_BROWSER } });
      robotsOk = r.ok;
      robotsTxt = r.ok ? await r.text() : "";
    } catch { /* réseau : traité comme absent */ }

    add({
      key: "robots_txt",
      label: "Fichier d'instructions aux robots",
      why: "C'est le fichier que tout moteur lit en premier pour savoir ce qu'il a le droit de visiter.",
      severity: "warning",
      status: robotsOk ? "pass" : "fail",
      detail: robotsOk ? "Le fichier robots.txt est bien accessible." : "Aucun fichier robots.txt trouvé.",
    });

    const blocksAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*(\n|$)/i.test(robotsTxt);
    add({
      key: "robots_allows",
      label: "Indexation autorisée",
      why: "Une seule ligne mal placée dans ce fichier peut rendre tout le site invisible sur Google.",
      severity: "critical",
      status: robotsOk && !blocksAll ? "pass" : "fail",
      detail: !robotsOk
        ? "Impossible à vérifier sans robots.txt."
        : blocksAll
          ? "Le fichier interdit l'indexation de tout le site."
          : "Les moteurs sont autorisés à parcourir le site.",
    });

    let sitemapOk = false;
    let sitemapUrls = 0;
    try {
      const s = await fetch(`${site}/sitemap.xml`, { headers: { "user-agent": UA_BROWSER } });
      const body = s.ok ? await s.text() : "";
      // Un 200 renvoyant la coquille de l'app (cas fréquent sur les SPA) n'est
      // pas un vrai sitemap : on exige du XML avec au moins une URL.
      sitemapOk = s.ok && /<urlset|<sitemapindex/i.test(body);
      sitemapUrls = (body.match(/<loc>/gi) ?? []).length;
    } catch { /* absent */ }

    add({
      key: "sitemap_xml",
      label: "Plan du site (sitemap)",
      why: "C'est la carte que vous donnez à Google : sans elle, il doit deviner quelles pages existent.",
      severity: "critical",
      status: sitemapOk ? "pass" : "fail",
      detail: sitemapOk ? `Plan du site trouvé, ${sitemapUrls} page(s) déclarée(s).` : "Aucun plan du site accessible.",
    });

    const sitemapDeclared = /Sitemap:\s*http/i.test(robotsTxt);
    add({
      key: "sitemap_declared",
      label: "Plan du site signalé aux robots",
      why: "Indiquer l'adresse du plan dans robots.txt accélère la découverte de vos pages.",
      severity: "warning",
      status: sitemapDeclared ? "pass" : "fail",
      detail: sitemapDeclared ? "Le plan du site est bien signalé." : "Le plan du site n'est pas signalé dans robots.txt.",
    });

    // ── Lisibilité du contenu ────────────────────────────────────────────
    add({
      key: "content_without_js",
      label: "Contenu lisible sans JavaScript",
      why: "Le contrôle le plus important : si le texte n'est pas dans la page envoyée, les moteurs et les IA ne voient qu'une page blanche.",
      severity: "critical",
      status: home.textLength >= 500 ? "pass" : "fail",
      detail: home.textLength >= 500
        ? `${home.textLength} caractères de texte directement lisibles.`
        : `Seulement ${home.textLength} caractères lisibles : la page est vide tant que le JavaScript n'est pas exécuté.`,
    });

    const homeGpt = await fetchPage(site + "/", UA_GPTBOT);
    add({
      key: "ai_crawler",
      label: "Visibilité pour les robots d'IA",
      why: "ChatGPT et Perplexity n'exécutent pas le JavaScript : ce qu'ils reçoivent ici est tout ce qu'ils sauront de vous.",
      severity: "critical",
      status: homeGpt.textLength >= 500 ? "pass" : "fail",
      detail: homeGpt.textLength >= 500
        ? `Les IA reçoivent ${homeGpt.textLength} caractères de contenu.`
        : `Les IA ne reçoivent que ${homeGpt.textLength} caractères : elles ne peuvent rien citer de votre site.`,
    });

    const withH1 = ok.filter((p) => p.h1Count > 0).length;
    add({
      key: "h1",
      label: "Titre principal sur chaque page",
      why: "C'est la première chose qu'un moteur lit pour comprendre le sujet de la page.",
      severity: "critical",
      status: ok.length > 0 && withH1 === ok.length ? "pass" : "fail",
      detail: `${withH1} page(s) sur ${ok.length} ont un titre principal.`,
    });

    // ── Balises par page ─────────────────────────────────────────────────
    const titles = ok.map((p) => p.title).filter(Boolean) as string[];
    const uniqueTitles = new Set(titles).size;
    add({
      key: "title_present",
      label: "Titre de page renseigné",
      why: "C'est la ligne bleue cliquable dans les résultats Google.",
      severity: "critical",
      status: ok.length > 0 && titles.length === ok.length ? "pass" : "fail",
      detail: `${titles.length} page(s) sur ${ok.length} ont un titre.`,
    });
    add({
      key: "title_unique",
      label: "Un titre différent par page",
      why: "Si toutes vos pages portent le même titre, Google considère qu'il n'y en a qu'une seule et ignore les autres.",
      severity: "critical",
      status: ok.length > 0 && uniqueTitles === ok.length ? "pass" : "fail",
      detail: uniqueTitles === ok.length
        ? `${uniqueTitles} titres distincts pour ${ok.length} pages.`
        : `Seulement ${uniqueTitles} titre(s) distinct(s) pour ${ok.length} pages : elles sont vues comme des doublons.`,
    });

    const descs = ok.map((p) => p.description).filter(Boolean) as string[];
    const uniqueDescs = new Set(descs).size;
    add({
      key: "description_present",
      label: "Description de page renseignée",
      why: "C'est le petit texte gris sous le titre dans Google : il décide si on clique ou pas.",
      severity: "warning",
      status: ok.length > 0 && descs.length === ok.length ? "pass" : "fail",
      detail: `${descs.length} page(s) sur ${ok.length} ont une description.`,
    });
    add({
      key: "description_unique",
      label: "Une description différente par page",
      why: "Une description recopiée à l'identique n'apporte aucune information sur la page en question.",
      severity: "critical",
      status: ok.length > 0 && uniqueDescs === ok.length ? "pass" : "fail",
      detail: uniqueDescs === ok.length
        ? `${uniqueDescs} descriptions distinctes.`
        : `Seulement ${uniqueDescs} description(s) distincte(s) pour ${ok.length} pages.`,
    });

    const withCanonical = ok.filter((p) => p.canonical).length;
    add({
      key: "canonical",
      label: "Adresse de référence déclarée",
      why: "Évite que Google considère plusieurs adresses comme du contenu dupliqué.",
      severity: "warning",
      status: ok.length > 0 && withCanonical === ok.length ? "pass" : "fail",
      detail: `${withCanonical} page(s) sur ${ok.length} déclarent leur adresse de référence.`,
    });

    const lang = (home.lang ?? "").toLowerCase();
    add({
      key: "lang",
      label: "Langue du site correctement déclarée",
      why: "Un site français déclaré en anglais est proposé aux mauvaises personnes dans les résultats.",
      severity: "warning",
      status: lang.startsWith("fr") ? "pass" : "fail",
      detail: lang ? `Le site se déclare en « ${lang} ».` : "Aucune langue déclarée.",
    });

    const ogImage = home.ogImage ?? "";
    const ogOk = ogImage.length > 0 && !/lovable\.dev|opengraph-image-p98pqg/i.test(ogImage);
    add({
      key: "og_image",
      label: "Image affichée au partage du lien",
      why: "C'est l'image qui apparaît quand on envoie le lien sur WhatsApp ou Instagram.",
      severity: "warning",
      status: ogOk ? "pass" : "fail",
      detail: !ogImage
        ? "Aucune image de partage définie."
        : ogOk
          ? "Une image de partage personnalisée est définie."
          : "L'image de partage est encore celle par défaut de l'outil de création du site.",
    });

    const withJsonLd = ok.filter((p) => p.jsonLd > 0).length;
    add({
      key: "structured_data",
      label: "Fiche d'identité structurée (Schema.org)",
      why: "Le format que Google et les IA lisent en priorité pour connaître vos tarifs, votre adresse et vos avis. C'est lui qui fait apparaître les étoiles dans les résultats.",
      severity: "critical",
      status: withJsonLd > 0 ? "pass" : "fail",
      detail: withJsonLd > 0
        ? `${withJsonLd} page(s) déclarent des données structurées.`
        : "Aucune donnée structurée : ni tarifs, ni localisation, ni avis déclarés.",
    });

    add({
      key: "pages_reachable",
      label: "Toutes les pages répondent",
      why: "Une page en erreur est une porte fermée, pour un visiteur comme pour un moteur.",
      severity: "critical",
      status: ok.length === pages.length ? "pass" : "fail",
      detail: `${ok.length} page(s) sur ${pages.length} répondent correctement.`,
    });

    // ── Score ────────────────────────────────────────────────────────────
    const passed = checks.filter((c) => c.status === "pass").length;
    const total = checks.length;
    const score = total ? Math.round((passed / total) * 100) : 0;
    const criticalCount = checks.filter((c) => c.status === "fail" && c.severity === "critical").length;
    const warningCount = checks.filter((c) => c.status === "fail" && c.severity === "warning").length;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("seo_audits")
      .insert({
        site_url: site,
        score,
        checks_passed: passed,
        checks_total: total,
        critical_count: criticalCount,
        warning_count: warningCount,
        checks,
        pages,
        duration_ms: Date.now() - started,
      })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, id: data.id, score, passed, total, criticalCount, warningCount }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("seo-audit", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
