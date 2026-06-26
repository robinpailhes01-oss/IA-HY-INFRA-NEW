"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, PenLine, RotateCcw, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  markContractSigned,
  unmarkContractSigned,
} from "@/app/(dashboard)/bookings/actions";

export function ContractActions({
  bookingId,
  isSigned,
  signedByName,
  signedAt,
  defaultName,
}: {
  bookingId: string;
  isSigned: boolean;
  signedByName: string | null;
  signedAt: string | null;
  defaultName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signOpen, setSignOpen] = useState(false);
  const [name, setName] = useState(defaultName);

  function handlePrint() {
    window.print();
  }

  function handleSign() {
    startTransition(async () => {
      const res = await markContractSigned(bookingId, name);
      if (!res.ok) {
        toast.error("Échec de la signature", { description: res.error ?? undefined });
        return;
      }
      toast.success("Contrat marqué comme signé");
      setSignOpen(false);
      router.refresh();
    });
  }

  function handleUnsign() {
    startTransition(async () => {
      const res = await unmarkContractSigned(bookingId);
      if (!res.ok) {
        toast.error("Échec", { description: res.error ?? undefined });
        return;
      }
      toast.success("Signature retirée");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isSigned ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <BadgeCheck className="size-3.5" />
            Signé {signedByName ? `par ${signedByName}` : ""}
            {signedAt ? ` — ${signedAt}` : ""}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnsign}
            disabled={pending}
            title="Retirer la signature (admin)"
          >
            <RotateCcw className="size-4" />
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSignOpen(true)}
        >
          <PenLine className="size-4" />
          Marquer comme signé
        </Button>
      )}
      <Button size="sm" onClick={handlePrint}>
        <Printer className="size-4" />
        Imprimer / PDF
      </Button>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marquer le contrat comme signé</DialogTitle>
            <DialogDescription>
              Saisis le nom du signataire — il apparaîtra sur le contrat à la place
              de la zone signature.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="signer-name">Nom du signataire</Label>
            <Input
              id="signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleSign} disabled={pending || !name.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              Confirmer la signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
