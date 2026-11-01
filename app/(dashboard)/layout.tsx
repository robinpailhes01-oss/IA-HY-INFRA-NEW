import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Header, type Attention } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { MotionProvider } from "@/components/shell/motion-provider";
import { LeaWidget } from "@/components/lea/lea-widget";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ce qui attend une réponse HUMAINE, affiché partout (badge de l'agent,
  // cloche) : c'est la seule information qui doit pouvoir interrompre Robin
  // quelle que soit la page où il se trouve.
  const [{ data: profile }, { data: leads }, { data: lastMessages }] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("leads")
      .select("id, status, needs_human_intervention")
      .eq("archived", false)
      .returns<{ id: string; status: string | null; needs_human_intervention: boolean | null }[]>(),
    supabase
      .from("lead_last_message")
      .select("lead_id")
      .eq("last_from_me", false)
      .returns<{ lead_id: string | null }[]>(),
  ]);

  const active = new Set(
    (leads ?? []).filter((l) => l.status !== "booked" && l.status !== "lost").map((l) => l.id),
  );
  const attention: Attention = {
    unanswered: (lastMessages ?? []).filter((m) => m.lead_id && active.has(m.lead_id)).length,
    takeover: (leads ?? []).filter((l) => l.needs_human_intervention && active.has(l.id)).length,
  };
  const attentionTotal = attention.unanswered + attention.takeover;

  // Deux plans seulement : le fond (les nappes de bleu) et le verre. La barre
  // latérale est une plaque flottante, détachée du bord ; le contenu pose ses
  // cartes directement sur le fond, pour que chacune ait de la couleur à
  // réfracter. Sur téléphone, la navigation descend sous le pouce.
  return (
    <MotionProvider>
      <div className="app-ambient min-h-dvh">
        <div className="mx-auto flex min-h-dvh max-w-[1680px] gap-6 px-3 pt-3 sm:px-5 lg:px-6 lg:pt-6">
          <aside className="vitre-shell sticky top-6 hidden h-[calc(100dvh-3rem)] w-[256px] shrink-0 rounded-[30px] lg:block">
            <SidebarNav attention={attentionTotal} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <Header
              email={user.email ?? ""}
              firstName={profile?.first_name ?? null}
              attention={attention}
            />
            {/* Marge basse : la barre d'onglets (téléphone) et l'orbe de Léa
                (partout) flottent au-dessus de la fin de page. */}
            <main className="flex-1 pb-44 pt-2 lg:pb-28">{children}</main>
          </div>
        </div>

        <MobileTabBar attention={attentionTotal} />
        <LeaWidget />
      </div>
    </MotionProvider>
  );
}
