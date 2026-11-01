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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Connexion impossible", {
        description: "Email ou mot de passe incorrect.",
      });
      setLoading(false);
      return;
    }

    router.refresh();
    router.replace("/");
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
          <CardTitle className="font-serif text-[30px] font-normal leading-tight tracking-[-0.01em]">
            {/* La porte d'entrée : la voix de la marque, en serif. */}
            Bon retour <em className="italic text-ocean">à bord</em>
          </CardTitle>
          <CardDescription>
            Accès réservé à l&apos;équipe Harmonie Yacht.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full"
            >
              {loading && <Loader2 className="animate-spin" />}
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
