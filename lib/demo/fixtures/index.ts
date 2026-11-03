/* eslint-disable @typescript-eslint/no-explicit-any */
// Assemble les fixtures du mode démo. Une table définie dans plusieurs
// fichiers voit ses lignes CONCATÉNÉES (core d'abord).
import { coreFixtures } from "@/lib/demo/fixtures/core";
import { socialFixtures } from "@/lib/demo/fixtures/social";
import { financeFixtures } from "@/lib/demo/fixtures/finance";
import { agentFixtures } from "@/lib/demo/fixtures/agent";
import { overviewFixtures } from "@/lib/demo/fixtures/overview";
import { extraFixtures } from "@/lib/demo/fixtures/extra";
import { comptaFixtures } from "@/lib/demo/fixtures/compta";

type Row = Record<string, any>;

let cache: Record<string, Row[]> | null = null;

export function getFixtures(): Record<string, Row[]> {
  if (cache) return cache;
  const out: Record<string, Row[]> = {};
  for (const part of [coreFixtures, socialFixtures, financeFixtures, agentFixtures, overviewFixtures, extraFixtures, comptaFixtures]) {
    for (const [table, rows] of Object.entries(part)) {
      out[table] = [...(out[table] ?? []), ...rows];
    }
  }
  cache = out;
  return out;
}
