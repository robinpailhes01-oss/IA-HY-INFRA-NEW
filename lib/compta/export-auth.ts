import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/** Client authentifié pour un export, ou null si personne n'est connecté. */
export async function exportClient(): Promise<SupabaseClient | null> {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export function yearParam(url: string): number {
  const y = Number(new URL(url).searchParams.get("annee"));
  const now = new Date().getFullYear();
  return Number.isInteger(y) && y >= 2020 && y <= now ? y : now;
}

/** ISO-8859-15 : l'encodage prévu par l'article A47 A-1 pour le FEC. */
const LATIN9: Record<string, number> = { "€": 0xa4, "Š": 0xa6, "š": 0xa8, "Ž": 0xb4, "ž": 0xb8, "Œ": 0xbc, "œ": 0xbd, "Ÿ": 0xbe };
export function latin9(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let i = 0;
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (LATIN9[ch] !== undefined) out[i++] = LATIN9[ch];
    else if (code < 0x100 && ![0xa4, 0xa6, 0xa8, 0xb4, 0xb8, 0xbc, 0xbd, 0xbe].includes(code)) out[i++] = code;
    else if (ch === "’" || ch === "‘") out[i++] = 0x27;
    else if (ch === "–" || ch === "—" || ch === "−") out[i++] = 0x2d;
    else if (ch === " " || ch === " ") out[i++] = 0x20;
    else out[i++] = 0x3f;
  }
  return out.slice(0, i);
}
