// Classement par règles et repères évidents (sans IA) — fonction pure, testée.
import { domainOf, type Category } from "./gmail.ts";

export type Decision = { category: Category | "a_classer"; action: "keep" | "trash"; confidence: number; reason: string; by: "regle" | "ia" | "repere" };

const BANK_TAX = /(^|\.)(qonto\.com|impots\.gouv\.fr|dgfip\.finances\.gouv\.fr|urssaf\.fr|douane\.gouv\.fr|ameli\.fr|infogreffe\.fr|inpi\.fr|greffe-tc|banquepopulaire|creditagricole|societegenerale|bnpparibas|sumup\.com|stripe\.com|axa\.fr|maif\.fr|macif\.fr)$/i;
const INVOICE_WORDS = /(facture|invoice|re[cç]u de paiement|receipt|avis d['’]é?ch[eé]ance|avis de pr[eé]l[eè]vement|paiement re[cç]u|payment received|your order|votre commande)/i;
const PROMO_WORDS = /(newsletter|promo|promotion|-\s?\d{1,2}\s?%|soldes|offre sp[eé]ciale|bon plan|derni[eè]re chance|ne manquez pas|vente flash|unsubscribe|d[eé]sabonn)/i;

export function decideByRules(
  m: { from_email: string | null; subject: string | null; has_attachment: boolean; bulk: boolean; attachment_names: string[] },
  rules: Array<{ kind: string; pattern: string; category: string; action: string }>,
): Decision | null {
  const email = m.from_email ?? "";
  const domain = domainOf(email) ?? "";
  const rule = rules.find((r) => (r.kind === "sender" && r.pattern === email) || (r.kind === "domain" && r.pattern === domain));
  if (rule) return { category: rule.category as Category, action: rule.action as "keep" | "trash", confidence: 1, reason: "Règle que tu as créée", by: "regle" };

  if (BANK_TAX.test(domain)) {
    const invoiceLike = m.has_attachment && INVOICE_WORDS.test(m.subject ?? "");
    return { category: invoiceLike ? "facture" : "banque_impots", action: "keep", confidence: 0.85, reason: "Banque, impôts ou assurance", by: "repere" };
  }
  if (m.has_attachment && INVOICE_WORDS.test(m.subject ?? "") && !m.bulk) {
    return { category: "facture", action: "keep", confidence: 0.8, reason: "Objet de facture avec une pièce jointe", by: "repere" };
  }
  if (m.bulk && PROMO_WORDS.test(m.subject ?? "")) {
    return { category: "newsletter", action: "trash", confidence: 0.75, reason: "Envoi de masse promotionnel", by: "repere" };
  }
  return null;
}

