import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CLEAR_BEFORE } from "@/lib/backup/restore-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Garde de la restauration. Trois verrous, tous nécessaires :
//   1. HY_ENABLE_RESTORE=1 dans les variables du projet (désactivée par défaut,
//      à retirer une fois la restauration terminée) ;
//   2. un utilisateur connecté, dont le profil a le rôle « admin » ;
//   3. la clé de service du projet (c'est elle qui écrit, jamais le navigateur).

export type RestoreContext = { db: SupabaseClient; supabaseUrl: string; email: string | null };
export type Denied = { error: string; status: number };

export async function restoreGuard(): Promise<RestoreContext | Denied> {
  if (process.env.HY_ENABLE_RESTORE !== "1") {
    return { error: "La restauration est désactivée (variable HY_ENABLE_RESTORE absente).", status: 403 };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { error: "Clé de service ou adresse Supabase manquante dans les variables du projet.", status: 500 };
  }
  const session = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return { error: "Non connecté", status: 401 };
  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (String((profile as { role?: string } | null)?.role ?? "").toLowerCase() !== "admin") {
    return { error: "Réservé aux administrateurs.", status: 403 };
  }
  return {
    db: createAdminClient() as unknown as SupabaseClient,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    email: user.email ?? null,
  };
}

export const isDenied = (v: RestoreContext | Denied): v is Denied => "status" in v;

export { CLEAR_BEFORE };
