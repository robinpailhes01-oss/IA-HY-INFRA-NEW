import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  // La coque : LA seule plaque de verre de l'application, qui contient la
  // navigation ET le contenu. C'est ce qui distingue une application d'une
  // page web — le menu n'est plus une barre collée au bord, il fait partie
  // du même objet. Le fond reste visible tout autour pour que le verre ait
  // quelque chose à réfracter.
  //
  // Tout ce qui est posé à l'intérieur est plat (.vitre). Quand chaque carte
  // était elle aussi floutée et ombrée, plus rien ne ressortait : la
  // profondeur ne se lit que s'il y a un seul plan matériel.
  return (
    <div className="app-ambient min-h-screen p-3 sm:p-5 lg:p-6">
      <div className="vitre-shell relative z-10 flex min-h-[calc(100vh-1.5rem)] rounded-[2rem] sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3rem)] lg:rounded-[2.25rem]">
        <aside className="hidden w-[15rem] shrink-0 border-r border-[var(--hairline)] py-6 md:block">
          <SidebarNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Header email={user.email ?? ""} firstName={profile?.first_name ?? null} />
          <main className="flex-1 px-4 pb-8 pt-2 sm:px-7 sm:pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
