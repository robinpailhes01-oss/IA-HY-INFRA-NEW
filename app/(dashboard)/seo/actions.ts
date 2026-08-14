"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Déclenche un passage de l'agent Auditeur (Edge Function `seo-audit`).
 *
 * L'appel passe par `functions.invoke`, qui transmet automatiquement la session
 * de l'utilisateur connecté — pas de secret partagé à configurer côté Vercel,
 * contrairement au Jarvis vocal. La fonction est protégée par la vérification
 * JWT côté Supabase : seul quelqu'un de connecté au dashboard peut la lancer.
 */
export async function runSeoAudit() {
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke("seo-audit", {
    method: "POST",
    body: {},
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (data?.error) {
    return { ok: false as const, error: String(data.error) };
  }

  revalidatePath("/seo");
  return { ok: true as const, error: null, score: data?.score as number | undefined };
}
