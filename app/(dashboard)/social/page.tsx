import { redirect } from "next/navigation";

// Provisoire : la page Réseaux sociaux est en cours de construction. En
// attendant, l'ancienne page Marketing tient la place.
export default function SocialPage() {
  redirect("/marketing");
}
