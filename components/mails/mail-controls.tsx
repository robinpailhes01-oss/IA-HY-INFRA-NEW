"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startGmailConnection, syncMailsNow } from "@/app/(dashboard)/mails/actions";

export function ConnectGmail({ inline = false }: { inline?: boolean }) {
  const [pending, setPending] = useState(false);
  async function go() {
    setPending(true);
    const r = await startGmailConnection();
    if (r.ok) window.location.href = r.url;
    else {
      toast.error("Connexion impossible", { description: r.error });
      setPending(false);
    }
  }
  return (
    <Button variant={inline ? "ghost" : "default"} size={inline ? "sm" : "lg"} onClick={go} disabled={pending} className={inline ? "ml-1 underline" : ""}>
      {pending ? <Loader2 className="animate-spin" /> : <Mail />}
      {inline ? "Reconnecter" : "Connecter Gmail"}
    </Button>
  );
}

export function SyncButton({ lastSync }: { lastSync: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {lastSync && <span className="t-caption hidden text-ink-3 sm:inline">Dernière synchro {lastSync}</span>}
      <Button
        variant="outline"
        size="sm"
        className="h-11 sm:h-8"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await syncMailsNow();
            if (!r.ok) toast.error("Synchronisation impossible", { description: r.error });
            else {
              toast.success(r.count ? `${r.count} nouveau${r.count > 1 ? "x" : ""} mail${r.count > 1 ? "s" : ""} trié${r.count > 1 ? "s" : ""}` : "Boîte à jour");
              router.refresh();
            }
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Synchroniser
      </Button>
    </div>
  );
}
