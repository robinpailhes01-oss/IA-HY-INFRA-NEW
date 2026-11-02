"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runSeoAudit } from "@/app/(dashboard)/seo/actions";

// Le seul bouton de l'espace qui déclenche un agent : pilule marine, 44 px
// de haut au téléphone (au pouce), 36 px au bureau. L'audit prend une dizaine
// de secondes — le libellé le dit pendant l'attente.
export function RunAuditButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={pending}
      className={cn("h-11 px-5 lg:h-9 lg:px-4", className)}
      onClick={() =>
        startTransition(async () => {
          const res = await runSeoAudit();
          if (!res.ok) {
            toast.error("L'audit n'a pas pu être lancé", {
              description: res.error ?? undefined,
            });
            return;
          }
          toast.success(
            res.score != null ? `Audit terminé — score ${res.score}/100` : "Audit terminé",
          );
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Analyse en cours…" : "Lancer un audit"}
    </Button>
  );
}
