import { redirect } from "next/navigation";

// Provisoire : la messagerie déménage ici. En attendant, elle vit encore sur
// /agent.
export default function ConversationsPage() {
  redirect("/agent");
}
