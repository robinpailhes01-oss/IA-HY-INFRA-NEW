/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures du mode démo — boîte mail triée par Léa (migration 0037).
import { demo } from "@/lib/demo/fixtures/core";

type Row = Record<string, any>;
const { daysFromNow } = demo;

let n = 0;
const id = () => `m${String(++n).padStart(15, "0")}`;
const at = (d: number, h = 10) => {
  const t = daysFromNow(-d);
  t.setUTCHours(h, 12, 0, 0);
  return t.toISOString();
};

// [jours, nom, e-mail, objet, extrait, pj, bulk, catégorie, action, raison, statut]
const PLAN: [number, string, string, string, string, boolean, boolean, string, string, string, string][] = [
  [0, "Chloé David", "chloe.david@example.com", "Question sur la sortie coucher de soleil", "Bonjour, est-ce qu'on peut venir à six ?", false, false, "client", "keep", "Demande d'un client", "inbox"],
  [1, "Camille Lefèvre", "camille.l@example.com", "Re : Nuit insolite du 29", "Parfait, on confirme pour quatre personnes.", false, false, "client", "keep", "Réponse à une réservation", "inbox"],
  [2, "TotalEnergies Port", "factures@totalenergies.example", "Votre facture de novembre", "Facture n° 2026-11-0832 en pièce jointe.", true, false, "facture", "keep", "Facture avec pièce jointe", "inbox"],
  [3, "Axa Plaisance", "echeances@axa.example", "Avis d'échéance assurance bateau", "Votre prochaine échéance est le 5 décembre.", true, false, "facture", "keep", "Avis d'échéance", "inbox"],
  [4, "URSSAF", "no-reply@urssaf.example", "Votre échéancier de cotisations", "Consultez votre échéancier dans votre espace.", false, false, "banque_impots", "keep", "Organisme officiel", "inbox"],
  [1, "Nautic Discount", "promo@nautic-discount.example", "-30 % sur les gilets, ce week-end seulement", "Profitez de notre vente flash…", false, true, "newsletter", "trash", "Promotion commerciale", "inbox"],
  [2, "Boatmag", "newsletter@boatmag.example", "Les 10 plus beaux mouillages d'hiver", "Cette semaine dans votre lettre…", false, true, "newsletter", "trash", "Newsletter", "inbox"],
  [2, "LinkedIn", "notifications@linkedin.example", "3 nouvelles personnes ont consulté votre profil", "Voir qui a consulté votre profil", false, true, "notification", "trash", "Notification de réseau social", "inbox"],
  [3, "Concours Gagnez", "win@gagnez-vite.example", "Vous avez été sélectionné !", "Cliquez ici pour récupérer votre cadeau.", false, true, "indesirable", "trash", "Démarchage douteux", "inbox"],
  [5, "Vercel", "billing@vercel.example", "Votre reçu Vercel", "Reçu de paiement en pièce jointe.", true, false, "facture", "keep", "Reçu de logiciel", "invoice"],
  [9, "Salon Nautique", "contact@salon-nautique.example", "Invitation exposant 2027", "Réservez votre stand avant le 15 janvier.", false, true, "newsletter", "trash", "Invitation commerciale", "trashed"],
];

export const mailFixtures: Record<string, Row[]> = {
  mail_account_status: [
    { id: "a0000000-0000-4000-8000-000000000001", email: "contact@harmonie-demo.example", status: "ok", last_error: null, connected_at: at(20), last_sync_at: at(0, 7) },
  ],
  mail_messages: PLAN.map(([d, name, email, subject, snippet, pj, bulk, category, action, reason, status]) => ({
    id: id(),
    account_id: "a0000000-0000-4000-8000-000000000001",
    thread_id: null,
    from_name: name,
    from_email: email,
    subject,
    snippet,
    received_at: at(d),
    has_attachment: pj,
    attachment_names: pj ? ["document.pdf"] : [],
    bulk,
    category,
    proposed_action: action,
    confidence: 0.9,
    reason,
    classified_by: "lea",
    status,
  })),
  mail_rules: [],
};
