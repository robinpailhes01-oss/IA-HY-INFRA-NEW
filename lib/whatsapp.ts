// WhatsApp privacy mode : un contact qui a activé la confidentialité de son
// numéro envoie son LID (Linked Device ID, ex. "1344375111872@lid") au lieu
// de son vrai numéro E.164. Côté Baileys on strip le suffixe `@lid` et on
// stocke `+1344375111872` dans wa_conversations.customer_phone — ce n'est pas
// un vrai téléphone, juste un identifiant interne WhatsApp.
//
// Heuristique : E.164 réel = max 15 chiffres total, mais 99% des numéros mobiles
// valides font 10 à 13 chiffres. Les LIDs observés en prod sont ≥ 14 chiffres.
export function isWhatsAppLid(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length > 13;
}

export function displayPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (isWhatsAppLid(phone)) return "Numéro masqué (privacy WhatsApp)";
  return phone;
}
