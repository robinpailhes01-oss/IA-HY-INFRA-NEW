// Ouvrir Léa depuis n'importe quel composant client, avec ou sans question :
//   askLea()                         → ouvre le panneau
//   askLea("Qui dois-je rappeler ?") → ouvre et envoie la question
// Un évènement de fenêtre plutôt qu'un contexte React : le widget vit dans
// la coque, les déclencheurs dans les pages — aucun fil à tirer entre eux.
export const LEA_ASK_EVENT = "lea:ask";

export function askLea(question?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string | undefined>(LEA_ASK_EVENT, { detail: question }));
}
