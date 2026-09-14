// Supabase Edge Function — mesure d'audience du site (traqueur maison)
//
// Reçoit un signal du navigateur à chaque page vue et enregistre d'où vient le
// visiteur. Remplace Vercel Web Analytics : historique permanent, données dans
// notre base (donc lisibles par le Manager), et classement des sources fait
// ici plutôt que subi.
//
// RGPD : aucun cookie, aucune IP stockée. visitor_hash = SHA-256 non réversible
// de (IP + user-agent + jour + sel), donc il change chaque jour : on peut
// compter les visiteurs uniques d'une journée, jamais suivre quelqu'un dans le
// temps ni remonter à une personne.
//
// Secrets (optionnels) :
//   TRACK_SALT          sel du hachage (à définir pour durcir l'anonymisation)
//   TRACK_ALLOWED_HOSTS domaines autorisés, séparés par des virgules
//                       (défaut : harmonie-yacht.fr et ses sous-domaines)

import { createClient } from "npm:@supabase/supabase-js@2";

const SALT = Deno.env.get("TRACK_SALT") ?? "harmonie-yacht-pageview-salt";
const ALLOWED_HOSTS = (Deno.env.get("TRACK_ALLOWED_HOSTS") ?? "harmonie-yacht.fr,teste-hysite.vercel.app")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Classement des provenances. L'ordre compte : on teste du plus spécifique au
// plus général, et tout ce qui n'est pas reconnu reste un "referral" nommé par
// son domaine — on ne perd jamais une source, même inconnue.
const SOURCE_RULES: Array<{ match: RegExp; label: string; group: string }> = [
  { match: /(^|\.)instagram\.com$/, label: "Instagram", group: "social" },
  { match: /(^|\.)facebook\.com$|(^|\.)fb\.me$/, label: "Facebook", group: "social" },
  { match: /(^|\.)tiktok\.com$/, label: "TikTok", group: "social" },
  { match: /(^|\.)whatsapp\.com$|(^|\.)wa\.me$/, label: "WhatsApp", group: "social" },
  { match: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, label: "YouTube", group: "social" },
  { match: /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, label: "LinkedIn", group: "social" },
  { match: /(^|\.)pinterest\./, label: "Pinterest", group: "social" },
  { match: /(^|\.)snapchat\.com$/, label: "Snapchat", group: "social" },
  { match: /(^|\.)(x|twitter)\.com$|(^|\.)t\.co$/, label: "X (Twitter)", group: "social" },
  { match: /(^|\.)google\./, label: "Google", group: "search" },
  { match: /(^|\.)bing\.com$/, label: "Bing", group: "search" },
  { match: /(^|\.)duckduckgo\.com$/, label: "DuckDuckGo", group: "search" },
  { match: /(^|\.)qwant\.com$/, label: "Qwant", group: "search" },
  { match: /(^|\.)ecosia\.org$/, label: "Ecosia", group: "search" },
  { match: /(^|\.)yahoo\./, label: "Yahoo", group: "search" },
  { match: /(^|\.)airbnb\./, label: "Airbnb", group: "referral" },
  { match: /(^|\.)tripadvisor\./, label: "TripAdvisor", group: "referral" },
  { match: /(^|\.)getyourguide\./, label: "GetYourGuide", group: "referral" },
];

// Les robots ne sont pas des visiteurs : les compter gonflerait le trafic et
// fausserait complètement la lecture.
const BOT_RE = /bot|crawler|spider|crawling|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios/i;

const noContent = () => new Response(null, { status: 204, headers: cors });

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function classify(
  referrerHost: string | null,
  utmSource: string | null,
  utmMedium: string | null,
): { label: string; group: string } {
  // Une campagne balisée prime sur le référent : c'est l'intention déclarée.
  if (utmSource) {
    const paid = /cpc|ppc|paid|ads?$/i.test(utmMedium ?? "");
    return {
      label: utmSource.charAt(0).toUpperCase() + utmSource.slice(1),
      group: paid ? "paid" : "campaign",
    };
  }
  if (!referrerHost) return { label: "Direct", group: "direct" };
  for (const rule of SOURCE_RULES) {
    if (rule.match.test(referrerHost)) return { label: rule.label, group: rule.group };
  }
  return { label: referrerHost, group: "referral" };
}

function deviceOf(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablette";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "ordinateur";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // On répond 204 même sur une requête invalide : ce endpoint est appelé depuis
  // le site, il ne doit jamais produire d'erreur visible ni ralentir la page.
  if (req.method !== "POST") return noContent();

  try {
    const body = await req.json().catch(() => ({}));
    const rawPath = typeof body.path === "string" ? body.path : "/";
    const path = rawPath.slice(0, 300) || "/";
    const referrerUrl = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua)) return noContent();

    // Garde-fou anti-pollution : on n'accepte que les appels venant du site.
    // Sans ça, n'importe qui pourrait gonfler les statistiques depuis l'extérieur.
    const originHost = hostOf(req.headers.get("origin")) ?? hostOf(req.headers.get("referer"));
    if (originHost && !ALLOWED_HOSTS.some((h) => originHost === h || originHost.endsWith("." + h))) {
      return noContent();
    }

    let referrerHost = hostOf(referrerUrl);
    // Navigation interne au site : ce n'est pas une provenance, c'est un
    // déplacement. La compter ferait apparaître le site comme sa propre source.
    if (referrerHost && ALLOWED_HOSTS.some((h) => referrerHost === h || referrerHost!.endsWith("." + h))) {
      referrerHost = null;
    }

    // Paramètres de campagne : lus dans l'URL de la page, pas du référent.
    let utmSource: string | null = null;
    let utmMedium: string | null = null;
    let utmCampaign: string | null = null;
    try {
      const qs = new URLSearchParams(String(body.search ?? "").replace(/^\?/, ""));
      utmSource = qs.get("utm_source");
      utmMedium = qs.get("utm_medium");
      utmCampaign = qs.get("utm_campaign");
    } catch {
      // query string illisible — on continue sans campagne
    }

    const { label, group } = classify(referrerHost, utmSource, utmMedium);

    // Jour en Europe/Paris : sans ça une visite de 23h30 tomberait le lendemain
    // en UTC et les journées seraient décalées pour Robin.
    const day = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 10);

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const visitorHash = await sha256(`${ip}|${ua}|${day}|${SALT}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("site_pageviews").insert({
      day,
      path,
      referrer_host: referrerHost,
      referrer_url: referrerUrl,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      source_label: label,
      source_group: group,
      visitor_hash: visitorHash,
      device: deviceOf(ua),
      country: req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null,
    });

    return noContent();
  } catch (e) {
    console.error("track-pageview:", e);
    return noContent();
  }
});
