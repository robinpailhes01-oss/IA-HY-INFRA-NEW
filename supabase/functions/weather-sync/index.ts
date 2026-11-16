// Supabase Edge Function — Météo marine de Carnon, mise à jour chaque matin.
//
// Remplit `weather_cache` (une ligne par jour, 10 jours) : c'est ce que lisent la
// carte « Prochaines sorties », le brief de Léa (« mer déconseillée vendredi »)
// et le récap quotidien.
//
// Sources :
//   · vent : MET Norway (api.met.no), gratuit, usage commercial autorisé avec un
//     User-Agent qui identifie l'application ;
//   · vagues, houle, température de l'eau : Open-Meteo Marine (gratuit pour un
//     usage non commercial — un usage commercial relève de leur offre payante :
//     OPEN_METEO_API_KEY, facultatif, bascule sur l'API « customer »).
//
// Secrets : CRON_SECRET. Facultatifs : WEATHER_LAT / WEATHER_LON (Carnon par défaut),
// seuils WEATHER_WIND_BAD_KMH (28), WEATHER_WAVE_BAD_M (1.0), WEATHER_WIND_IDEAL_KMH (15),
// WEATHER_WAVE_IDEAL_M (0.5), OPEN_METEO_API_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const LAT = Number(Deno.env.get("WEATHER_LAT") ?? "43.5511");
const LON = Number(Deno.env.get("WEATHER_LON") ?? "3.9806");
const WIND_BAD = Number(Deno.env.get("WEATHER_WIND_BAD_KMH") ?? "28");
const WAVE_BAD = Number(Deno.env.get("WEATHER_WAVE_BAD_M") ?? "1.0");
const WIND_IDEAL = Number(Deno.env.get("WEATHER_WIND_IDEAL_KMH") ?? "15");
const WAVE_IDEAL = Number(Deno.env.get("WEATHER_WAVE_IDEAL_M") ?? "0.5");
const OPEN_METEO_KEY = Deno.env.get("OPEN_METEO_API_KEY") ?? "";
const UA = "HarmonieYacht-Dashboard/1.0 https://harmonie-yacht.fr";
const TZ = "Europe/Paris";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
const cardinal = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });
const parisDay = (d: Date) => dayFmt.format(d);
const parisHour = (d: Date) => Number(hourFmt.format(d)) % 24;

type Day = { wind?: number; dir?: string; wave?: number; swell?: number; temp?: number };

async function windByDay(): Promise<Map<string, Day>> {
  const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT.toFixed(4)}&lon=${LON.toFixed(4)}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`MET Norway ${res.status}`);
  const data = await res.json();
  const byDay = new Map<string, Array<{ kmh: number; deg: number; hour: number }>>();
  for (const t of data?.properties?.timeseries ?? []) {
    const d = new Date(t.time);
    const det = t?.data?.instant?.details;
    if (!det || typeof det.wind_speed !== "number") continue;
    const day = parisDay(d);
    const arr = byDay.get(day) ?? [];
    arr.push({ kmh: det.wind_speed * 3.6, deg: det.wind_from_direction ?? 0, hour: parisHour(d) });
    byDay.set(day, arr);
  }
  const out = new Map<string, Day>();
  for (const [day, pts] of byDay) {
    // Les heures de sortie : 9 h – 19 h. Au-delà de 2 jours, les points sont toutes les 6 h :
    // à défaut de créneau de jour, on prend toute la journée.
    const daytime = pts.filter((p) => p.hour >= 9 && p.hour <= 19);
    const use = daytime.length > 0 ? daytime : pts;
    const max = use.reduce((a, b) => (b.kmh > a.kmh ? b : a));
    out.set(day, { wind: round1(max.kmh), dir: cardinal(max.deg) });
  }
  return out;
}

async function marineByDay(): Promise<Map<string, Day>> {
  const host = OPEN_METEO_KEY ? "customer-marine-api.open-meteo.com" : "marine-api.open-meteo.com";
  const key = OPEN_METEO_KEY ? `&apikey=${encodeURIComponent(OPEN_METEO_KEY)}` : "";
  const url =
    `https://${host}/v1/marine?latitude=${LAT}&longitude=${LON}` +
    `&daily=wave_height_max,swell_wave_height_max&hourly=sea_surface_temperature&timezone=${encodeURIComponent(TZ)}&forecast_days=10${key}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(`Open-Meteo Marine: ${data?.reason ?? res.status}`);
  const out = new Map<string, Day>();
  const times: string[] = data?.daily?.time ?? [];
  const hourly: string[] = data?.hourly?.time ?? [];
  const sst: Array<number | null> = data?.hourly?.sea_surface_temperature ?? [];
  times.forEach((day, i) => {
    const idx = hourly.indexOf(`${day}T12:00`);
    const wave = data.daily.wave_height_max?.[i];
    const swell = data.daily.swell_wave_height_max?.[i];
    const temp = idx >= 0 ? sst[idx] : null;
    out.set(day, {
      wave: typeof wave === "number" ? round2(wave) : undefined,
      swell: typeof swell === "number" ? round2(swell) : undefined,
      temp: typeof temp === "number" ? round1(temp) : undefined,
    });
  });
  return out;
}

export function rate(wind?: number, wave?: number): "ideal" | "acceptable" | "discouraged" | null {
  if (wind === undefined && wave === undefined) return null;
  const w = wind ?? 0;
  const h = wave ?? 0;
  if (w >= WIND_BAD || h >= WAVE_BAD) return "discouraged";
  if (w <= WIND_IDEAL && h <= WAVE_IDEAL) return "ideal";
  return "acceptable";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  const errors: string[] = [];
  const [wind, marine] = await Promise.all([
    windByDay().catch((e) => (errors.push(String(e.message ?? e)), new Map<string, Day>())),
    marineByDay().catch((e) => (errors.push(String(e.message ?? e)), new Map<string, Day>())),
  ]);

  const today = parisDay(new Date());
  const days = [...new Set([...wind.keys(), ...marine.keys()])].filter((d) => d >= today).sort().slice(0, 10);
  if (days.length === 0) return json({ error: "aucune prévision disponible", details: errors }, 502);

  const now = new Date().toISOString();
  const rows = days.map((date) => {
    const w = wind.get(date);
    const m = marine.get(date);
    return {
      date,
      fetched_at: now,
      rating: rate(w?.wind, m?.wave),
      wind_speed_kmh: w?.wind ?? null,
      wind_direction: w?.dir ?? null,
      wave_height_m: m?.wave != null ? round1(m.wave) : null,
      swell_m: m?.swell != null ? round1(m.swell) : null,
      water_temp_c: m?.temp ?? null,
    };
  });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase.from("weather_cache").upsert(rows, { onConflict: "date" });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, days: rows.length, partial: errors.length > 0 ? errors : undefined, first: rows[0] });
});
