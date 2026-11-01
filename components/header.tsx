"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, MessageCircleWarning, Search, Settings, UserRoundCheck } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/shell/brand-mark";
import { CommandPalette } from "@/components/shell/command-palette";
import { SectionTabs } from "@/components/shell/section-tabs";
import { LeaStatusPill } from "@/components/lea-status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(firstName: string | null, email: string) {
  if (firstName) {
    const parts = firstName.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return email[0]?.toUpperCase() ?? "?";
}

// Bouton rond en verre — la matière commune de tous les contrôles d'en-tête.
const ROUND =
  "relative grid size-10 shrink-0 place-items-center rounded-full border border-white/90 bg-white/65 text-ink-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] backdrop-blur-xl transition-colors duration-200 hover:bg-white hover:text-foreground";

export type Attention = { unanswered: number; takeover: number };

export function Header({
  email,
  firstName,
  attention,
}: {
  email: string;
  firstName: string | null;
  attention: Attention;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const initials = getInitials(firstName, email);
  const displayName = firstName ?? email.split("@")[0];
  const total = attention.unanswered + attention.takeover;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="pb-2 pt-1 lg:pb-4 lg:pt-0">
      <div className="flex h-14 items-center gap-2.5">
        {/* Téléphone : la marque à gauche (la barre latérale n'existe pas). */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <BrandMark className="size-9 rounded-[12px]" />
          <span className="truncate text-[15px] font-semibold tracking-[-0.025em] text-foreground">
            Harmonie Yacht
          </span>
        </Link>

        {/* Bureau : les sous-onglets de l'espace courant, au centre du regard. */}
        <SectionTabs className="hidden lg:inline-flex" />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={cn(
              ROUND,
              "flex items-center justify-center gap-2.5 xl:w-60 xl:justify-start xl:px-4",
            )}
            aria-label="Rechercher (⌘K)"
          >
            <Search className="size-[17px]" strokeWidth={1.8} />
            <span className="hidden flex-1 text-left text-[13px] font-medium text-ink-3 xl:inline">
              Rechercher…
            </span>
            <kbd className="hidden rounded-md border border-[var(--hairline-strong)] bg-white px-1.5 text-[10.5px] font-medium text-ink-3 xl:inline">
              ⌘K
            </kbd>
          </button>

          <span className="hidden md:block">
            <LeaStatusPill />
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" className={ROUND} aria-label="À traiter" />}
            >
              <Bell className="size-[17px]" strokeWidth={1.8} />
              {total > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-[#edf3fa] bg-danger px-1 text-[10px] font-semibold tabular-nums text-white">
                  {total}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="px-2.5 py-2 text-[12px] font-semibold text-ink-3">
                À traiter maintenant
              </DropdownMenuLabel>
              {total === 0 ? (
                <p className="px-2.5 pb-3 text-[13px] text-muted-foreground">
                  Rien n&apos;attend ta réponse. Léa gère.
                </p>
              ) : (
                <>
                  {attention.unanswered > 0 && (
                    <DropdownMenuItem render={<Link href="/leads?view=priority&bucket=unanswered" />}>
                      <MessageCircleWarning className="text-danger" />
                      <span className="flex-1">
                        {attention.unanswered} client{attention.unanswered > 1 ? "s" : ""} sans réponse
                      </span>
                    </DropdownMenuItem>
                  )}
                  {attention.takeover > 0 && (
                    <DropdownMenuItem render={<Link href="/leads?view=priority&bucket=takeover" />}>
                      <UserRoundCheck className="text-warning" />
                      <span className="flex-1">
                        {attention.takeover} lead{attention.takeover > 1 ? "s" : ""} à reprendre
                      </span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Menu utilisateur"
                  className="flex h-10 items-center gap-2 rounded-full border border-white/90 bg-white/65 p-1 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.05)] backdrop-blur-xl transition-colors hover:bg-white sm:pr-3.5"
                />
              }
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-[linear-gradient(150deg,#7cc0f5,#2f7fe0)] text-[11px] font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-[13px] font-semibold tracking-[-0.015em] text-foreground sm:inline">
                {displayName}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="px-2.5 py-2">
                <span className="block text-[13.5px] font-semibold text-foreground">{displayName}</span>
                <span className="block text-xs font-normal text-muted-foreground">{email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={signOut}>
                <DropdownMenuItem
                  variant="destructive"
                  render={<button type="submit" className="w-full" />}
                >
                  <LogOut />
                  Se déconnecter
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Téléphone : les sous-onglets passent sous la barre, défilables. */}
      <div className="mt-2 lg:hidden">
        <SectionTabs className="w-full" />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
