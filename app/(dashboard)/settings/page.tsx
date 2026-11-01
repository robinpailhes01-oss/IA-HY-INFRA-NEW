import Link from "next/link";
import { ArrowUpRight, Landmark, SlidersHorizontal } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { LeaStatusPill } from "@/components/lea-status-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateLong } from "@/lib/format";

// Les réglages ne sont pas encore éditables depuis le tableau de bord : la
// page dit honnêtement ce qui est branché (et depuis quand) plutôt que
// d'afficher des interrupteurs qui ne feraient rien.
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: accounts }] = await Promise.all([
    user
      ? supabase.from("profiles").select("first_name, email, role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("bank_accounts")
      .select("name, balance_updated_at")
      .neq("status", "closed")
      .returns<{ name: string | null; balance_updated_at: string | null }[]>(),
  ]);

  const lastSync = (accounts ?? [])
    .map((a) => a.balance_updated_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Outils"
        title="Paramètres"
        description="Ton compte et l'état des connexions qui alimentent le tableau de bord."
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <Card className="rise">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Le compte connecté à ce tableau de bord.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-[var(--hairline)] text-[13.5px]">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-ink-2">Prénom</dt>
                <dd className="font-medium text-foreground">{profile?.first_name ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-ink-2">Email</dt>
                <dd className="truncate font-medium text-foreground">{user?.email ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-ink-2">Rôle</dt>
                <dd className="font-medium text-foreground">{profile?.role ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="rise delay-1">
          <CardHeader>
            <CardTitle>Connexions</CardTitle>
            <CardDescription>Les sources que l&apos;agent IA lit en continu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LeaStatusPill variant="card" />
            <div className="flex items-center gap-3 rounded-[20px] border border-white/90 bg-white/60 p-2.5 pr-3 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)]">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[rgba(11,37,69,0.06)] text-navy">
                <Landmark className="size-[18px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold tracking-[-0.015em] text-foreground">
                  Banque · Qonto
                </span>
                <span className={`block truncate text-[11.5px] font-medium ${lastSync ? "text-success" : "text-ink-3"}`}>
                  {lastSync ? `Solde synchronisé le ${formatDateLong(lastSync)}` : "Pas encore synchronisée"}
                </span>
              </span>
              <Link
                href="/finances"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-ink-3 shadow-[var(--shadow-glass)] hover:text-ocean"
                aria-label="Voir la finance"
              >
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <EmptyState icon={<SlidersHorizontal />} title="Préférences bientôt modifiables ici" className="rise delay-2">
        Horaires de Léa, relances automatiques et notifications se règlent pour
        l&apos;instant dans la configuration de l&apos;agent (Manager sur Telegram).
      </EmptyState>
    </div>
  );
}
