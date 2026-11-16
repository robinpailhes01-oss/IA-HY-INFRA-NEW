// Supabase Edge Function — Actions sur les mails, demandées depuis le tableau de bord.
//
//   trash          → corbeille Gmail (récupérable 30 jours). JAMAIS de suppression définitive.
//   untrash        → remet dans la boîte de réception.
//   label_invoice  → étiquette « Factures » et sort de la boîte de réception.
//   keep           → marque « à garder » (le mail ne sera plus proposé à la corbeille).
//
// Appel : POST avec x-dashboard-secret ; corps { action, ids: string[] }. Seuls les mails déjà
// connus de mail_messages sont touchés (200 au plus par appel).

import { createClient } from "npm:@supabase/supabase-js@2";
import { accessToken, connectedAccount, gmail, json } from "../_shared/gmail.ts";

const DASHBOARD_SECRET = Deno.env.get("DASHBOARD_AGENT_SECRET") ?? "";
const MAX_IDS = 200;
const INVOICE_LABEL = "Factures";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!DASHBOARD_SECRET || req.headers.get("x-dashboard-secret") !== DASHBOARD_SECRET) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as { action?: string; ids?: string[] } | null;
  const action = body?.action ?? "";
  if (!["trash", "untrash", "label_invoice", "keep"].includes(action)) return json({ error: "Action inconnue" }, 400);
  const ids = [...new Set((body?.ids ?? []).filter((i) => typeof i === "string" && /^[0-9a-f]{8,24}$/i.test(i)))].slice(0, MAX_IDS);
  if (ids.length === 0) return json({ error: "Aucun mail" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: known } = await supabase.from("mail_messages").select("id").in("id", ids);
  const valid = (known ?? []).map((r) => r.id as string);
  if (valid.length === 0) return json({ error: "Mails inconnus" }, 404);
  const now = new Date().toISOString();

  if (action === "keep") {
    await supabase.from("mail_messages").update({ proposed_action: "keep", classified_by: "robin", updated_at: now }).in("id", valid);
    return json({ ok: true, count: valid.length });
  }

  const account = await connectedAccount(supabase);
  if (!account) return json({ error: "Aucune boîte connectée" }, 409);
  try {
    const token = await accessToken(supabase, account);

    if (action === "trash") {
      await gmail(token, "/messages/batchModify", { method: "POST", body: JSON.stringify({ ids: valid, addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] }) });
      await supabase.from("mail_messages").update({ status: "trashed", trashed_at: now, updated_at: now }).in("id", valid);
    } else if (action === "untrash") {
      await gmail(token, "/messages/batchModify", { method: "POST", body: JSON.stringify({ ids: valid, addLabelIds: ["INBOX"], removeLabelIds: ["TRASH"] }) });
      await supabase.from("mail_messages").update({ status: "inbox", trashed_at: null, updated_at: now }).in("id", valid);
    } else {
      const labels = await gmail(token, "/labels");
      let label = (labels?.labels ?? []).find((l: { name: string }) => l.name === INVOICE_LABEL);
      if (!label) {
        label = await gmail(token, "/labels", {
          method: "POST",
          body: JSON.stringify({ name: INVOICE_LABEL, labelListVisibility: "labelShow", messageListVisibility: "show" }),
        });
      }
      await gmail(token, "/messages/batchModify", { method: "POST", body: JSON.stringify({ ids: valid, addLabelIds: [label.id], removeLabelIds: ["INBOX"] }) });
      await supabase.from("mail_messages").update({ status: "invoice", category: "facture", classified_by: "robin", updated_at: now }).in("id", valid);
    }
    return json({ ok: true, count: valid.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
