import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo/mode";
import { LEA_TOOLS, runLeaTool } from "@/lib/lea/tools";
import { askManager } from "@/lib/lea/manager";

// ═══════════════════════════════════════════════════════════════════════
// Léa, la manageuse du tableau de bord — la boucle d'agent.
//
// Le widget envoie l'historique de la conversation (texte seulement) ; Léa
// lit et agit avec les outils de lib/lea/tools.ts, qui passent par les
// mêmes actions serveur que les boutons de l'interface, avec la session de
// Robin. Ce qui sort de son périmètre est délégué à l'agent Manager.
//
// Sans ANTHROPIC_API_KEY côté serveur, on retombe sur l'agent Manager seul
// (le comportement d'avant) plutôt que de casser le widget.
// ═══════════════════════════════════════════════════════════════════════

export const maxDuration = 120;

const MODEL = process.env.LEA_MODEL ?? "claude-opus-5-5";
const MAX_STEPS = 10;

type ChatTurn = { role: "user" | "lea"; text: string };
type ActionTrace = { label: string; ok: boolean };

const SYSTEM = `Tu es Léa, la manageuse IA d'Harmonie Yacht (location de yacht privatisé au port de Carnon : sorties en mer de 2 à 4 h, Nuits Insolites et Nuit Prestige à bord, e-foil). Tu travailles avec Robin, le propriétaire, directement dans son tableau de bord. Tu le tutoies.

Tu as les mains sur tout le tableau de bord : leads (créer, modifier, changer d'étape, noter, relancer, écrire au client, archiver), réservations (créer, modifier, encaisser un solde, annuler), finances (dépenses, revenus, synthèse), événements publics. Pour la configuration de Léa WhatsApp (offres, prix, règles), l'analyse financière détaillée, la caisse espèces ou la performance marketing, passe par ask_manager.

Manière de travailler :
- Retrouve toujours l'élément concerné avec une recherche (search_leads, list_bookings) avant d'agir ; n'invente jamais un id. Si plusieurs fiches correspondent, demande laquelle.
- Les actions ordinaires (créer ou modifier une fiche, changer une étape, ajouter une note, enregistrer une dépense, encaisser) : fais-les directement quand la demande est claire, puis dis précisément ce que tu as fait.
- Les actions sensibles (écrire à un client, relancer, archiver, annuler une réservation) : décris d'abord exactement ce qui va partir ou disparaître — le texte du message mot pour mot, le nom des personnes — et demande « Je confirme ? ». N'appelle l'outil avec confirmed=true que lorsque Robin vient de répondre oui.
- Ne dis jamais qu'une action est faite si l'outil n'a pas renvoyé ok: true dans ce tour. En cas d'échec, dis-le franchement et propose une solution.
- Les messages aux clients : chaleureux, naturels, vouvoiement, signés de l'équipe Harmonie Yacht, jamais les mots bruts de Robin recopiés.
- Réponds court, en français, sans markdown lourd (pas de titres, pas de tableaux) : c'est un petit panneau de chat, souvent lu sur iPhone. Les montants en euros, les dates en toutes lettres.`;

function lastUserText(history: ChatTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].role === "user") return history[i].text;
  return "";
}

export async function POST(req: NextRequest) {
  // Un widget de tableau de bord, pas une API publique : session obligatoire.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { messages?: ChatTurn[] };
  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "lea") && typeof m.text === "string" && m.text.trim())
    .slice(-24);
  const userText = lastUserText(history);
  if (!userText) return NextResponse.json({ error: "message requis" }, { status: 400 });

  // Pas de clé Anthropic côté tableau de bord (ou mode démo) : l'agent Manager
  // seul, comme avant — il lit et agit déjà sur une partie du périmètre.
  if (!process.env.ANTHROPIC_API_KEY || DEMO_MODE) {
    const r = await askManager(userText);
    if (DEMO_MODE) {
      const demo = await fetch(new URL("/api/jarvis", req.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: userText }),
      }).then((x) => x.json() as Promise<{ reply?: string }>).catch(() => ({ reply: undefined }));
      return NextResponse.json({ reply: demo.reply ?? r.reply, actions: [] });
    }
    return NextResponse.json(
      r.ok ? { reply: r.reply, actions: [] } : { error: r.error ?? "Léa est indisponible." },
      { status: r.ok ? 200 : 502 },
    );
  }

  const client = new Anthropic();
  // L'historique arrive en texte : la mémoire fine (résultats d'outils) vit
  // dans les données elles-mêmes — Léa relit ce qu'il faut à chaque tour.
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const role = m.role === "user" ? "user" : "assistant";
    const prev = messages.at(-1);
    if (prev && prev.role === role) prev.content = `${prev.content as string}\n\n${m.text}`;
    else messages.push({ role, content: m.text });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const actions: ActionTrace[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        // Consignes et outils figés → mis en cache ; la date (qui change)
        // vient après le point de cache.
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: `Aujourd'hui : ${today} (heure de Paris). Robin est connecté.` },
        ],
        tools: LEA_TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return NextResponse.json({ reply: "Je ne peux pas traiter cette demande.", actions });
      }

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const reply = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return NextResponse.json({ reply: reply || "C'est fait.", actions });
      }

      // Les outils d'un même tour s'exécutent l'un après l'autre : deux
      // écritures sur la même fiche ne doivent pas se croiser.
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const outcome = await runLeaTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, userText).catch(
          (e: unknown) => ({ result: JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), isError: true, action: undefined }),
        );
        if (outcome.action) actions.push(outcome.action);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: outcome.result, is_error: outcome.isError });
      }
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({
      reply: "J'ai fait une partie du travail mais la demande était longue — vérifie ce qui a été pris en compte ci-dessous et redonne-moi la suite.",
      actions,
    });
  } catch (e) {
    console.error("[lea] erreur", e);
    const message =
      e instanceof Anthropic.RateLimitError
        ? "Je suis très sollicitée, réessaie dans un instant."
        : e instanceof Anthropic.APIError
          ? `Erreur du service IA (${e.status}).`
          : "Erreur technique — réessaie.";
    return NextResponse.json({ error: message, actions }, { status: 502 });
  }
}
