import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEMO_MODE } from "@/lib/demo/mode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_TABLES, SENSITIVE_TABLES, VIEW_NAMES } from "@/lib/backup/tables";

// Sauvegarde complète du projet Supabase, pilotée depuis le tableau de bord.
//
// Pourquoi ici : la base n'a pas d'autre copie, et le tableau de bord est le
// seul endroit où l'on est sûr d'avoir (1) une session connectée et (2) la clé
// de service qui lit TOUT, y compris ce que les règles de sécurité cachent.
//
// Règles :
//   · il faut être connecté ; sans cela, rien ne sort ;
//   · la clé de service ne quitte jamais le serveur : le navigateur ne reçoit
//     que les lignes, page par page ;
//   · les accès sensibles (utilisateurs, session WhatsApp) exigent le rôle
//     « admin » dans `profiles`.

export type BackupContext = {
  db: SupabaseClient;
  /** Vrai si la clé de service est utilisée (lecture sans RLS). */
  service: boolean;
  isAdmin: boolean;
  email: string | null;
  supabaseUrl: string;
};

export async function backupGuard(): Promise<BackupContext | null> {
  const session = (await createClient()) as unknown as SupabaseClient;
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;

  const { data: profile } = await session.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = String((profile as { role?: string } | null)?.role ?? "").toLowerCase() === "admin";

  const hasService = !DEMO_MODE && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    db: hasService ? (createAdminClient() as unknown as SupabaseClient) : session,
    service: hasService,
    isAdmin,
    email: user.email ?? null,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  };
}

export type OpenApi = { definitions?: Record<string, unknown>; [k: string]: unknown };

/** Le schéma tel que le publie PostgREST : tables, colonnes, types, clés. */
export async function fetchOpenApi(ctx: BackupContext): Promise<OpenApi | null> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ctx.service || !key || !ctx.supabaseUrl) return null;
  try {
    const res = await fetch(`${ctx.supabaseUrl}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as OpenApi;
  } catch {
    return null;
  }
}

export type TableInfo = { name: string; kind: "table" | "view"; count: number | null; error: string | null; sensitive: boolean };

export async function buildManifest(ctx: BackupContext, includeSensitive: boolean) {
  const openapi = await fetchOpenApi(ctx);
  const discovered = openapi?.definitions ? Object.keys(openapi.definitions) : [];
  const names = [...new Set([...(KNOWN_TABLES as readonly string[]), ...discovered])].sort();
  const views = new Set<string>(VIEW_NAMES);
  const sensitive = new Set<string>(SENSITIVE_TABLES);

  const tables: TableInfo[] = await Promise.all(
    names.map(async (name) => {
      const isSensitive = sensitive.has(name);
      if (isSensitive && !(includeSensitive && ctx.isAdmin)) {
        return { name, kind: "table" as const, count: null, error: "exclue (accès sensible)", sensitive: true };
      }
      const { count, error } = await ctx.db.from(name).select("*", { count: "exact", head: true });
      return {
        name,
        kind: views.has(name) ? ("view" as const) : ("table" as const),
        count: error ? null : (count ?? 0),
        error: error ? error.message : null,
        sensitive: isSensitive,
      };
    }),
  );

  // Fichiers du stockage.
  type FileInfo = { bucket: string; path: string; size: number | null };
  const files: FileInfo[] = [];
  const buckets: Array<{ id: string; public: boolean }> = [];
  let storageError: string | null = null;
  try {
    const { data: list, error } = await ctx.db.storage.listBuckets();
    if (error) throw error;
    for (const b of list ?? []) {
      buckets.push({ id: b.id, public: b.public });
      const walk = async (prefix: string, depth: number) => {
        if (depth > 6 || files.length > 20000) return;
        for (let offset = 0; ; offset += 1000) {
          const { data: items, error: e } = await ctx.db.storage.from(b.id).list(prefix, { limit: 1000, offset });
          if (e) throw e;
          if (!items || items.length === 0) break;
          for (const it of items) {
            const full = prefix ? `${prefix}/${it.name}` : it.name;
            if (it.id === null) await walk(full, depth + 1);
            else files.push({ bucket: b.id, path: full, size: (it.metadata as { size?: number } | null)?.size ?? null });
          }
          if (items.length < 1000) break;
        }
      };
      await walk("", 0);
    }
  } catch (e) {
    storageError = e instanceof Error ? e.message : String(e);
  }

  return {
    generatedAt: new Date().toISOString(),
    supabaseUrl: ctx.supabaseUrl,
    service: ctx.service,
    isAdmin: ctx.isAdmin,
    openapi: openapi !== null,
    tables,
    buckets,
    files,
    storageError,
  };
}

export const PAGE_SIZE = 1000;

/** Une page de lignes. Tri par `id` quand la table en a un, pour que les pages ne se chevauchent pas. */
export async function fetchPage(ctx: BackupContext, table: string, from: number) {
  const base = () => ctx.db.from(table).select("*").range(from, from + PAGE_SIZE - 1);
  let res = await base().order("id", { ascending: true });
  if (res.error && /does not exist|42703|column/i.test(res.error.message)) res = await base();
  return res;
}

export function validTableName(name: string | null): name is string {
  return typeof name === "string" && /^[a-z][a-z0-9_]{0,62}$/.test(name);
}
