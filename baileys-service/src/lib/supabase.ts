import { createClient } from '@supabase/supabase-js';
import type { AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Persist Baileys auth state in Supabase (survives Railway restarts)
export async function useSupabaseAuthState() {
  const { initAuthCreds, BufferJSON } = await import('@whiskeysockets/baileys');

  const read = async (id: string) => {
    const { data } = await supabase.from('wa_auth_state').select('data').eq('id', id).single();
    if (!data) return null;
    return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver);
  };

  const write = async (id: string, value: object) => {
    await supabase.from('wa_auth_state').upsert({
      id,
      data: JSON.parse(JSON.stringify(value, BufferJSON.replacer)),
      updated_at: new Date().toISOString(),
    });
  };

  const remove = async (id: string) => {
    await supabase.from('wa_auth_state').delete().eq('id', id);
  };

  const credsRaw = await read('creds');
  const creds: AuthenticationCreds = credsRaw ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
          const result: Record<string, any> = {};
          await Promise.all(ids.map(async (id) => {
            const val = await read(`${type}-${id}`);
            if (val) result[id] = val;
          }));
          return result;
        },
        set: async (data: Record<string, Record<string, any>>) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const val = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(val ? write(key, val) : remove(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => write('creds', creds),
  };
}

export async function upsertConversation(customerPhone: string, customerName?: string) {
  const { data } = await supabase
    .from('wa_conversations')
    .upsert(
      { customer_phone: customerPhone, customer_name: customerName ?? null, last_message_at: new Date().toISOString() },
      { onConflict: 'customer_phone' }
    )
    .select()
    .single();
  return data;
}

export async function saveMessage(
  conversationId: string,
  fromMe: boolean,
  body: string,
  isFromHuman: boolean,
  waMessageId?: string,
) {
  await supabase.from('wa_messages').insert({
    conversation_id: conversationId,
    from_me: fromMe,
    is_from_human: isFromHuman,
    body,
    wa_message_id: waMessageId ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function isConversationPaused(customerPhone: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_conversations')
    .select('is_paused, paused_until')
    .eq('customer_phone', customerPhone)
    .single();

  if (!data?.is_paused) return false;

  if (data.paused_until && new Date(data.paused_until) < new Date()) {
    await supabase
      .from('wa_conversations')
      .update({ is_paused: false, paused_until: null })
      .eq('customer_phone', customerPhone);
    return false;
  }
  return true;
}

export async function pauseConversation(customerPhone: string, hours = 24) {
  const pausedUntil = new Date(Date.now() + hours * 3_600_000).toISOString();
  await supabase
    .from('wa_conversations')
    .update({ is_paused: true, paused_until: pausedUntil })
    .eq('customer_phone', customerPhone);
}

export async function resumeConversation(customerPhone: string) {
  await supabase
    .from('wa_conversations')
    .update({ is_paused: false, paused_until: null })
    .eq('customer_phone', customerPhone);
}

// Résolution LID → numéro réel (voir migration wa_lid_phone_mapping). Appelé
// dès que Baileys nous révèle la correspondance (partage explicite du numéro,
// sync des contacts/historique) — on garde une trace dans wa_lid_map ET on
// remplit leads.real_phone pour tout lead déjà identifié par ce LID, afin que
// le Manager et le dashboard puissent enfin le relancer directement.
export async function upsertLidMapping(lid: string, phone: string, source = 'baileys') {
  if (!lid || !phone || lid === phone) return;
  await supabase.from('wa_lid_map').upsert(
    { lid, phone, source, updated_at: new Date().toISOString() },
    { onConflict: 'lid' },
  );
  await supabase.from('leads').update({ real_phone: phone }).eq('phone', lid).is('real_phone', null);
}

// Vide la table wa_auth_state — appelé quand WhatsApp invalide la session
// (déconnexion de l'appareil lié dans WhatsApp Business). Sans ça, le service
// resterait coincé avec des credentials morts au lieu de générer un nouveau QR.
export async function clearSupabaseAuthState() {
  const { error } = await supabase.from('wa_auth_state').delete().neq('id', '');
  if (error) throw error;
}
