// Helper serveur — déclenche la sync Google Calendar après chaque action booking.
// À appeler depuis les Server Actions (app/(dashboard)/bookings/actions.ts, etc.)
// Ne bloque jamais : si GCal est indisponible, on log et on continue.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SYNC_SECRET = process.env.SYNC_GCAL_SECRET ?? "";
const SYNC_URL = `${SUPABASE_URL}/functions/v1/sync-gcal`;

type SyncAction = "upsert" | "delete";
type SyncType = "booking" | "event_public";

export async function syncGCal(
  action: SyncAction,
  type: SyncType,
  id: string,
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    };
    if (SYNC_SECRET) headers["x-sync-secret"] = SYNC_SECRET;
    const res = await fetch(SYNC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, type, id }),
    });
    if (!res.ok) {
      console.error(`sync-gcal ${action} ${type} ${id} → ${res.status}`, await res.text());
    }
  } catch (e) {
    console.error("sync-gcal fetch failed (GCal indisponible, ignoré)", e);
  }
}
