"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runSeoAudit } from "@/app/(dashboard)/seo/actions";

export function RunAuditButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={pending}
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
