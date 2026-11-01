"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/brand-mark";
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
    <main className="app-ambient flex min-h-dvh items-center justify-center p-5">
      <Card className="rise w-full max-w-[400px] rounded-[30px] py-7">
        <CardHeader className="space-y-1 px-7 text-center">
          <div className="mb-3 flex flex-col items-center gap-3">
            <BrandMark className="size-12 rounded-[16px]" />
            <span className="text-[13px] font-semibold tracking-[-0.015em] text-ink-2">
              Harmonie Yacht · pilotage
            </span>
          </div>
          <CardTitle className="font-serif text-[28px] font-normal leading-tight tracking-[-0.01em]">
            Créer un compte (dev)
          </CardTitle>
          <CardDescription>
            Page de développement — création des comptes équipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="h-11"
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
                className="h-11"
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
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full">
              {loading && <Loader2 className="animate-spin" />}
              Créer le compte
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
