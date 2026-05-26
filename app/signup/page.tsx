import { notFound } from "next/navigation";

import { SignupForm } from "./signup-form";

export default function SignupPage() {
  // Création de compte réservée au développement local — pas de signup public.
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <SignupForm />;
}
