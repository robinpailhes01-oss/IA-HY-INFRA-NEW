// Le plan de comptes du tableau de bord — miroir EXACT de la graine de la
// migration 0035 (accounting_accounts). Sert de repli tant que la migration
// n'est pas appliquée, et aux libellés côté client. Modifier l'un = modifier
// l'autre.

export type AccountKind =
  | "charge"
  | "produit"
  | "immobilisation"
  | "tva"
  | "tiers"
  | "tresorerie"
  | "capital"
  | "attente";

export type Account = {
  code: string;
  label: string;
  kind: AccountKind;
  default_vat_rate: number;
  needs_receipt: boolean;
  grp: string;
  sort: number;
  active: boolean;
};

export const DEFAULT_ACCOUNTS: Account[] = [
  { code: "706100", label: "Sorties en mer", kind: "produit", default_vat_rate: 10, needs_receipt: true, grp: "Ventes", sort: 10, active: true },
  { code: "706200", label: "Nuits insolites", kind: "produit", default_vat_rate: 10, needs_receipt: true, grp: "Ventes", sort: 11, active: true },
  { code: "706300", label: "eFoil", kind: "produit", default_vat_rate: 20, needs_receipt: true, grp: "Ventes", sort: 12, active: true },
  { code: "706000", label: "Autres prestations", kind: "produit", default_vat_rate: 20, needs_receipt: true, grp: "Ventes", sort: 13, active: true },
  { code: "708000", label: "Produits annexes", kind: "produit", default_vat_rate: 20, needs_receipt: true, grp: "Ventes", sort: 14, active: true },
  { code: "758000", label: "Produits divers", kind: "produit", default_vat_rate: 0, needs_receipt: true, grp: "Ventes", sort: 15, active: true },
  { code: "606100", label: "Carburant, eau, énergie", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Bateau", sort: 20, active: true },
  { code: "615500", label: "Entretien et réparations bateau", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Bateau", sort: 21, active: true },
  { code: "613200", label: "Place de port", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Bateau", sort: 22, active: true },
  { code: "616000", label: "Assurances", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Bateau", sort: 23, active: true },
  { code: "606300", label: "Petit équipement (< 500 € HT)", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Bateau", sort: 24, active: true },
  { code: "604000", label: "Sous-traitance (skippers, prestataires)", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Activité", sort: 30, active: true },
  { code: "613500", label: "Locations de matériel", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Activité", sort: 31, active: true },
  { code: "625700", label: "Réceptions, accueil clients", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Activité", sort: 32, active: true },
  { code: "606400", label: "Fournitures administratives", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Fonctionnement", sort: 40, active: true },
  { code: "651100", label: "Logiciels et abonnements", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Fonctionnement", sort: 41, active: true },
  { code: "623000", label: "Publicité et marketing", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Fonctionnement", sort: 42, active: true },
  { code: "622600", label: "Honoraires", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Fonctionnement", sort: 43, active: true },
  { code: "626000", label: "Téléphone, internet, poste", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Fonctionnement", sort: 44, active: true },
  { code: "625100", label: "Déplacements", kind: "charge", default_vat_rate: 20, needs_receipt: true, grp: "Fonctionnement", sort: 45, active: true },
  { code: "627000", label: "Frais bancaires et commissions", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Fonctionnement", sort: 46, active: true },
  { code: "641000", label: "Salaires", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Personnel et État", sort: 50, active: true },
  { code: "645000", label: "Charges sociales (URSSAF…)", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Personnel et État", sort: 51, active: true },
  { code: "635000", label: "Impôts et taxes (CFE…)", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Personnel et État", sort: 52, active: true },
  { code: "695000", label: "Impôt sur les sociétés", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Personnel et État", sort: 53, active: true },
  { code: "661000", label: "Intérêts d'emprunt", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Personnel et État", sort: 54, active: true },
  { code: "671000", label: "Charges exceptionnelles (amendes…)", kind: "charge", default_vat_rate: 0, needs_receipt: true, grp: "Personnel et État", sort: 55, active: true },
  { code: "218200", label: "Bateau, matériel de transport", kind: "immobilisation", default_vat_rate: 20, needs_receipt: true, grp: "Investissements", sort: 60, active: true },
  { code: "215400", label: "Matériel nautique (> 500 € HT)", kind: "immobilisation", default_vat_rate: 20, needs_receipt: true, grp: "Investissements", sort: 61, active: true },
  { code: "218300", label: "Matériel informatique (> 500 € HT)", kind: "immobilisation", default_vat_rate: 20, needs_receipt: true, grp: "Investissements", sort: 62, active: true },
  { code: "445510", label: "Paiement de TVA aux impôts", kind: "tva", default_vat_rate: 0, needs_receipt: false, grp: "État, associés, banque", sort: 70, active: true },
  { code: "445670", label: "Remboursement de crédit de TVA", kind: "tva", default_vat_rate: 0, needs_receipt: false, grp: "État, associés, banque", sort: 71, active: true },
  { code: "455000", label: "Compte courant d'associé", kind: "tiers", default_vat_rate: 0, needs_receipt: false, grp: "État, associés, banque", sort: 72, active: true },
  { code: "101300", label: "Apport en capital", kind: "capital", default_vat_rate: 0, needs_receipt: false, grp: "État, associés, banque", sort: 73, active: true },
  { code: "164000", label: "Emprunt (capital remboursé ou reçu)", kind: "capital", default_vat_rate: 0, needs_receipt: true, grp: "État, associés, banque", sort: 74, active: true },
  { code: "580000", label: "Virement interne (dépôt d'espèces…)", kind: "tresorerie", default_vat_rate: 0, needs_receipt: false, grp: "État, associés, banque", sort: 75, active: true },
  { code: "471000", label: "À classer (compte d'attente)", kind: "attente", default_vat_rate: 0, needs_receipt: false, grp: "État, associés, banque", sort: 99, active: true },
];

/** Compte d'attente : un mouvement classé ici reste « à classer ». */
export const SUSPENSE_ACCOUNT = "471000";

export const VAT_RATES = [0, 2.1, 5.5, 10, 20] as const;

export const BANK_ACCOUNT = { code: "512000", label: "Banque Qonto" };
export const CASH_ACCOUNT = { code: "530000", label: "Caisse espèces" };
export const VAT_COLLECTED = { code: "445710", label: "TVA collectée" };
export const VAT_DEDUCTIBLE_GOODS = { code: "445660", label: "TVA déductible sur biens et services" };
export const VAT_DEDUCTIBLE_ASSETS = { code: "445620", label: "TVA déductible sur immobilisations" };
export const VAT_REVERSE_COLLECTED = { code: "445200", label: "TVA due intracommunautaire / autoliquidée" };
export const BANK_FEES = { code: "627000", label: "Frais bancaires et commissions" };
