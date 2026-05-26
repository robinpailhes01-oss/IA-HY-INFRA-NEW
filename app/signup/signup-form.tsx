"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SignupForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName } },
    });

    if (error) {
      toast.error("Création impossible", { description: error.message });
      setLoading(false);
      return;
    }

    toast.success("Compte créé", {
      description: "Tu peux maintenant te connecter.",
    });
    router.replace("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="text-2xl font-semibold tracking-tight">
            <span className="text-gold">⚓</span> Harmonie{" "}
            <span className="text-gold">Yacht</span>
          </div>
          <CardTitle className="text-lg font-medium">
            Créer un compte (dev)
          </CardTitle>
          <CardDescription>
            Page de développement — création des comptes équipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="prenom@harmonie-yacht.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-10"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading && <Loader2 className="animate-spin" />}
              Créer le compte
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
