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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="text-2xl font-semibold tracking-tight">
            <span className="text-gold">⚓</span> Harmonie{" "}
            <span className="text-gold">Yacht</span>
          </div>
          <CardTitle className="text-lg font-medium">Connexion</CardTitle>
          <CardDescription>
            Accès réservé à l&apos;équipe Harmonie Yacht.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                className="h-10"
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
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full"
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
