"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, User } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

export function Header({
  email,
  firstName,
}: {
  email: string;
  firstName: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = getInitials(firstName, email);
  const displayName = firstName ?? email.split("@")[0];

  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-7">
      <div className="flex items-center gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Ouvrir le menu"
              />
            }
          >
            <Menu />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[15rem] max-w-[80vw] border-r border-[var(--hairline)] bg-[#0A1829] p-0 pt-6"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Menu utilisateur"
              className="flex items-center gap-2.5 rounded-full border-[0.5px] border-[var(--hairline)] bg-[var(--surface)] py-1.5 pl-1.5 pr-4 transition-colors duration-200 [transition-timing-function:var(--ease-ios)] hover:bg-[var(--surface-hover)]"
            />
          }
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-[linear-gradient(145deg,#17395C,#0A1F35)] text-[10.5px] font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-[13.5px] font-semibold tracking-[-0.015em] text-foreground sm:inline">
            {displayName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings" />}>
            <User />
            Profil
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
    </header>
  );
}
