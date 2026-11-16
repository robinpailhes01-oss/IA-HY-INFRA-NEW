// Catégories de mails — mêmes valeurs que la colonne mail_messages.category et que
// les fonctions Edge (supabase/functions/_shared/gmail.ts). Sans dépendance serveur :
// importable côté navigateur.

export const MAIL_CATEGORIES = [
  "client",
  "facture",
  "banque_impots",
  "fournisseur",
  "newsletter",
  "notification",
  "indesirable",
  "autre",
  "a_classer",
] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<MailCategory, string> = {
  client: "Client",
  facture: "Facture",
  banque_impots: "Banque et impôts",
  fournisseur: "Fournisseur",
  newsletter: "Newsletter",
  notification: "Notification",
  indesirable: "Indésirable",
  autre: "Autre",
  a_classer: "À classer",
};

/** Catégories pour lesquelles on peut proposer la corbeille. */
export const TRASHABLE: MailCategory[] = ["newsletter", "notification", "indesirable"];

export type MailRow = {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  has_attachment: boolean;
  bulk: boolean;
  category: MailCategory;
  proposed_action: "keep" | "trash";
  confidence: number | null;
  reason: string | null;
  classified_by: string | null;
  status: "inbox" | "trashed" | "invoice";
};

export type MailAccount = {
  id: string;
  email: string;
  status: string;
  last_error: string | null;
  connected_at: string;
  last_sync_at: string | null;
};

export type MailAction = "trash" | "untrash" | "label_invoice" | "keep";
