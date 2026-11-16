// Supabase Edge Function — Récap quotidien de Léa.
//
// Chaque matin : la météo marine du jour et des deux jours suivants, les sorties
// du jour et du lendemain, les clients qui attendent une réponse, les nouveaux
// leads, l'argent à encaisser. Le texte est enregistré dans `recaps` (type
// 'daily', un par jour) puis envoyé là où c'est configuré :
//   · Telegram : TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_ID
//   · e-mail (Resend) : RESEND_API_KEY + OWNER_EMAIL (+ RESEND_FROM)
// Sans aucun des deux, le récap est quand même enregistré (visible dans la base).
//
// Secrets : CRON_SECRET. Appel : POST avec l'en-tête x-cron-secret.
// Corps facultatif : { "dry_run": true } pour voir le texte sans l'envoyer ni l'enregistrer.

import { createClient } from "npm:@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_OWNER_CHAT_ID = Deno.env.get("TELEGRAM_OWNER_CHAT_ID") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Harmonie Yacht <reservations@harmonie-yacht.fr>";
const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "";
const TZ = "Europe/Paris";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const parisDay = (d: Date) => dayFmt.format(d);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const longDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const dec = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hhmm = (t: string | null) => (t ? t.slice(0, 5).replace(":", " h ") : "");
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const RATING: Record<string, string> = { ideal: "idéal", acceptable: "correct", discouraged: "déconseillé" };
const RATING_ICON: Record<string, string> = { ideal: "☀️", acceptable: "⛅", discouraged: "🌬️" };

type Booking = {
  date: string;
  start_time: string | null;
  offer_name: string | null;
  party_size: number | null;
  status: string | null;
  balance_due: number | null;
  deposit_paid: boolean | null;
  deposit_amount: number | null;
  customers: { first_name: string | null; last_name: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { dry_run?: boolean };

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const today = parisDay(new Date());
  const tomorrow = addDays(today, 1);
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const [weatherRes, bookingsRes, waitingRes, takeoverRes, newLeadsRes, dueRes, nextRes] = await Promise.all([
    supabase.from("weather_cache").select("*").gte("date", today).order("date").limit(3),
    supabase
      .from("bookings")
      .select("date, start_time, offer_name, party_size, status, balance_due, deposit_paid, deposit_amount, customers(first_name, last_name)")
      .gte("date", today)
      .lte("date", tomorrow)
      .neq("status", "cancelled")
      .order("date")
      .order("start_time")
      .returns<Booking[]>(),
    supabase.from("lead_last_message").select("lead_id, last_message_at").eq("last_from_me", false).order("last_message_at", { ascending: false }).limit(1000),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("needs_human_intervention", true).eq("archived", false).not("status", "in", "(booked,lost)"),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase
      .from("bookings")
      .select("balance_due, deposit_paid, deposit_amount")
      .gte("date", today)
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("date, start_time, offer_name, customers(first_name, last_name)")
      .gt("date", tomorrow)
      .neq("status", "cancelled")
      .order("date")
      .limit(1)
      .returns<Array<Pick<Booking, "date" | "start_time" | "offer_name" | "customers">>>(),
  ]);

  // Clients qui attendent : même définition que le tableau de bord (leads actifs dont le dernier
  // message vient du client, hors conversations que Léa a escaladées vers toi).
  const lastAt = new Map<string, string>((waitingRes.data ?? []).map((w) => [w.lead_id as string, w.last_message_at as string]));
  let waiting: Array<{ id: string; first_name: string | null; last_name: string | null; phone: string | null }> = [];
  if (lastAt.size > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone, last_interaction_at")
      .in("id", [...lastAt.keys()])
      .eq("archived", false)
      .eq("needs_human_intervention", false)
      .not("status", "in", "(booked,lost)")
      .order("last_interaction_at", { ascending: false });
    waiting = data ?? [];
  }
  const weekAgo = Date.now() - 7 * 86_400_000;
  const staleCount = waiting.filter((w) => Date.parse(lastAt.get(w.id) ?? "") < weekAgo).length;
  const nameOf = (p: { first_name: string | null; last_name: string | null; phone?: string | null } | null) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(" ") || (p?.phone ? `contact …${p.phone.slice(-4)}` : "client");

  const lines: string[] = [];
  lines.push(`☀️ Récap du ${longDay(today)}`);

  // Météo marine
  lines.push("", "Météo marine · Carnon");
  const weather = weatherRes.data ?? [];
  if (weather.length === 0) {
    lines.push("• Prévisions indisponibles pour le moment.");
  } else {
    for (const w of weather) {
      const label = w.date === today ? "Aujourd'hui" : w.date === tomorrow ? "Demain" : longDay(w.date);
      const bits: string[] = [];
      if (w.wind_speed_kmh != null) bits.push(`vent ${Math.round(Number(w.wind_speed_kmh))} km/h${w.wind_direction ? ` ${w.wind_direction}` : ""}`);
      if (w.wave_height_m != null) bits.push(`vagues ${dec(Number(w.wave_height_m))} m`);
      if (w.water_temp_c != null) bits.push(`eau ${Math.round(Number(w.water_temp_c))} °C`);
      const rating = w.rating ? `${RATING_ICON[w.rating] ?? ""} ${RATING[w.rating] ?? w.rating}` : "non noté";
      lines.push(`• ${label} : ${rating}${bits.length ? ` — ${bits.join(", ")}` : ""}`);
    }
  }

  // Sorties
  const bookings = bookingsRes.data ?? [];
  const listFor = (day: string) => bookings.filter((b) => b.date === day);
  lines.push("", "Sorties");
  for (const [day, label] of [[today, "Aujourd'hui"], [tomorrow, "Demain"]] as const) {
    const list = listFor(day);
    if (list.length === 0) {
      lines.push(`• ${label} : aucune sortie.`);
      continue;
    }
    for (const b of list) {
      const risky = weather.find((w) => w.date === day)?.rating === "discouraged";
      const when = hhmm(b.start_time);
      lines.push(
        `• ${label}${when ? ` ${when}` : ""} — ${b.offer_name ?? "Sortie"}, ${nameOf(b.customers)}` +
          `${b.party_size ? `, ${b.party_size} pers.` : ""}` +
          `${b.balance_due && b.balance_due > 0 ? ` (solde ${eur(Number(b.balance_due))})` : ""}` +
          `${risky ? " ⚠️ mer déconseillée : prévenir le client ?" : ""}`,
      );
    }
  }

  const next = nextRes.data?.[0];
  if (next && bookings.length === 0) {
    lines.push(`• Prochaine sortie : ${longDay(next.date)}${next.start_time ? ` à ${hhmm(next.start_time)}` : ""} — ${next.offer_name ?? "sortie"}, ${nameOf(next.customers)}.`);
  }

  // À traiter
  lines.push("", "À traiter");
  const nWaiting = waiting.length;
  lines.push(
    nWaiting > 0
      ? `• ${nWaiting} ${plural(nWaiting, "client attend", "clients attendent")} ta réponse : ${waiting.slice(0, 5).map(nameOf).join(", ")}${nWaiting > 5 ? "…" : ""}`
      : "• Aucun client en attente de réponse.",
  );
  if (staleCount > 0) lines.push(`  (dont ${staleCount} depuis plus de 7 jours.)`);
  const nTakeover = takeoverRes.count ?? 0;
  if (nTakeover > 0) lines.push(`• ${nTakeover} ${plural(nTakeover, "conversation à reprendre", "conversations à reprendre")} (Léa attend ta décision).`);
  const nNew = newLeadsRes.count ?? 0;
  lines.push(`• ${nNew} ${plural(nNew, "nouveau lead", "nouveaux leads")} sur 24 h.`);

  // Argent
  const due = (dueRes.data ?? []).reduce(
    (s, b) => s + (b.deposit_paid ? 0 : Number(b.deposit_amount ?? 0)) + Number(b.balance_due ?? 0),
    0,
  );
  lines.push("", "Argent", due > 0 ? `• Reste à encaisser sur les sorties à venir : ${eur(due)}.` : "• Rien à encaisser sur les sorties à venir.");

  const text = lines.join("\n");
  if (body.dry_run) return json({ ok: true, dry_run: true, text });

  // Enregistrement (un seul récap par jour : remplace celui du matin si relancé).
  const data = { weather, bookings: bookings.length, waiting: nWaiting, takeover: nTakeover, new_leads: nNew, due };
  await supabase.from("recaps").delete().eq("type", "daily").eq("period_end", today);
  const { error: saveErr } = await supabase
    .from("recaps")
    .insert({ type: "daily", content: text, data, period_start: today, period_end: today });
  if (saveErr) return json({ error: `enregistrement: ${saveErr.message}` }, 500);

  // Envoi
  const sent: Record<string, string> = {};
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_OWNER_CHAT_ID) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_OWNER_CHAT_ID, text }),
    });
    sent.telegram = res.ok ? "ok" : `échec ${res.status}`;
  }
  if (RESEND_API_KEY && OWNER_EMAIL) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [OWNER_EMAIL], subject: `Récap du ${longDay(today)}`, text }),
    });
    sent.email = res.ok ? "ok" : `échec ${res.status}`;
  }
  if (Object.values(sent).includes("ok")) {
    await supabase.from("recaps").update({ sent_at: new Date().toISOString() }).eq("type", "daily").eq("period_end", today);
  }
  return json({ ok: true, sent, text });
});
