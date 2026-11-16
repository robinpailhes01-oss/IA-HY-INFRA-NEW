import { assertEquals } from "jsr:@std/assert@1";
import { decideByRules } from "./mail-classify.ts";

const base = { from_email: "x@y.fr", subject: "", has_attachment: false, bulk: false, attachment_names: [] as string[] };

Deno.test("règle apprise sur l'expéditeur : prioritaire", () => {
  const d = decideByRules({ ...base, from_email: "promo@shop.fr", subject: "Facture" }, [{ kind: "sender", pattern: "promo@shop.fr", category: "newsletter", action: "trash" }]);
  assertEquals([d?.category, d?.action, d?.by], ["newsletter", "trash", "regle"]);
});
Deno.test("règle sur le domaine", () => {
  const d = decideByRules({ ...base, from_email: "a@boite.com" }, [{ kind: "domain", pattern: "boite.com", category: "fournisseur", action: "keep" }]);
  assertEquals(d?.category, "fournisseur");
});
Deno.test("impôts : à garder", () => {
  const d = decideByRules({ ...base, from_email: "ne-pas-repondre@impots.gouv.fr", subject: "Votre avis" }, []);
  assertEquals([d?.category, d?.action], ["banque_impots", "keep"]);
});
Deno.test("facture Qonto avec pièce jointe → facture", () => {
  const d = decideByRules({ ...base, from_email: "no-reply@qonto.com", subject: "Votre facture de novembre", has_attachment: true }, []);
  assertEquals(d?.category, "facture");
});
Deno.test("objet de facture + pièce jointe, expéditeur inconnu → facture", () => {
  const d = decideByRules({ ...base, from_email: "compta@port-carnon.fr", subject: "Facture n°2026-114", has_attachment: true }, []);
  assertEquals([d?.category, d?.action], ["facture", "keep"]);
});
Deno.test("envoi de masse promotionnel → corbeille proposée", () => {
  const d = decideByRules({ ...base, from_email: "news@marque.com", subject: "-30 % ce week-end seulement", bulk: true }, []);
  assertEquals([d?.category, d?.action], ["newsletter", "trash"]);
});
Deno.test("un vrai client n'est jamais proposé à la corbeille par repère", () => {
  const d = decideByRules({ ...base, from_email: "camille@gmail.com", subject: "Disponibilité le 24 décembre ?" }, []);
  assertEquals(d, null);
});
Deno.test("facture reçue d'une newsletter (envoi de masse) : pas classée facture par repère", () => {
  const d = decideByRules({ ...base, from_email: "info@x.fr", subject: "Votre facture est disponible", has_attachment: true, bulk: true }, []);
  assertEquals(d?.category === "facture", false);
});
