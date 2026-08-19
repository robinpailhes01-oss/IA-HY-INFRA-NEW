"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { importIcsFile } from "@/app/(dashboard)/archives/actions";

/**
 * Le fichier est lu côté navigateur (FileReader) puis son contenu texte est
 * envoyé à l'action serveur — pas d'upload vers un stockage de fichiers,
 * inutile pour un usage ponctuel d'import.
 */
export function UploadIcsButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      startTransition(async () => {
        const res = await importIcsFile(content, file.name);
        if (!res.ok) {
          toast.error("Import échoué", { description: res.error });
          return;
        }
        toast.success(
          `${res.data.imported} client(s) importé(s)`,
          {
            description: `${res.data.eventsRead} événement(s) lus dans le fichier${
              res.data.skippedNoAttendee > 0
                ? `, ${res.data.skippedNoAttendee} sans invité identifiable ignoré(s)`
                : ""
            }.`,
          },
        );
        router.refresh();
      });
    };
    reader.onerror = () => toast.error("Impossible de lire ce fichier.");
    reader.readAsText(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />}
        {pending ? "Import en cours…" : "Importer un fichier .ics"}
      </Button>
    </>
  );
}
