import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Client Supabase en clé de service — contourne RLS. Réservé aux routes qui
 * doivent écrire sans session utilisateur (ex. /api/unsubscribe, cliqué
 * depuis un email par quelqu'un qui n'est jamais connecté au dashboard).
 *
 * Ne JAMAIS importer ce fichier dans un composant client ni dans du code qui
 * pourrait finir dans le bundle navigateur — la clé de service donne un accès
 * total à la base.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
