/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures du mode démo — récap quotidien de Léa (fonction daily-recap).
import { demo } from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;
const { iso, NOW } = demo;

const today = new Date(NOW);
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const day = (n: number) => longDay.format(new Date(NOW.getTime() + n * 86_400_000));

const content = [
  `☀️ Récap du ${day(0)}`,
  "",
  "Météo marine · Carnon",
  "• Aujourd'hui : ⛅ correct — vent 22 km/h SSO, vagues 0,9 m, eau 16 °C",
  "• Demain : ☀️ idéal — vent 12 km/h NO, vagues 0,4 m, eau 16 °C",
  `• ${day(2)} : 🌬️ déconseillé — vent 31 km/h NO, vagues 1,3 m, eau 16 °C`,
  "",
  "Sorties",
  "• Aujourd'hui : aucune sortie.",
  "• Demain : aucune sortie.",
  "• Prochaine sortie : dimanche 29 novembre à 18 h 00 — Nuit Prestige, Bernadet.",
  "",
  "À traiter",
  "• 2 clients attendent ta réponse : Chloé David, Camille Lefèvre",
  "• 2 conversations à reprendre (Léa attend ta décision).",
  "• 1 nouveau lead sur 24 h.",
  "",
  "Argent",
  "• Reste à encaisser sur les sorties à venir : 1 071 €.",
].join("\n");

const recaps: Row[] = [
  {
    id: "5ec40000-0000-4000-8000-000000000001",
    type: "daily",
    content,
    data: {},
    period_start: iso(today),
    period_end: iso(today),
    sent_at: null,
    created_at: new Date(NOW.getTime() - 4 * 3_600_000).toISOString(),
  },
];

export const recapFixtures: Record<string, Row[]> = { recaps };
