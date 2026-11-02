import { redirect } from "next/navigation";

// L'ancienne page Marketing est absorbée par Réseaux sociaux (/social) :
// attribution payant / organique, budget pub, ROAS, coût par réservation et
// carnet de contenus y vivent désormais, avec les mêmes règles de calcul.
// On garde l'adresse pour les favoris et les liens déjà envoyés.
export default function MarketingPage() {
  redirect("/social");
}
