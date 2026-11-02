import { Suspense } from "react";

import { Inbox } from "@/components/agent/inbox/inbox";

// La boîte de réception WhatsApp de Léa. Tout vit côté client (sondage des
// fils toutes les 3 à 5 s) ; la page ne fait que poser le cadre.
//
// Suspense est obligatoire : Inbox lit `?phone=` avec useSearchParams, qui
// sans frontière ferait basculer toute la route en rendu client.
export default function ConversationsPage() {
  return (
    <Suspense fallback={null}>
      <Inbox />
    </Suspense>
  );
}
