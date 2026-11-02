"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateLeadStatus } from "@/app/(dashboard)/leads/actions";
import { fullName, type Lead, type LeadStatus } from "@/lib/leads";
import { LeadDetailHeader } from "@/components/leads/lead-detail-sheet/header";
import { TabInfos } from "@/components/leads/lead-detail-sheet/tab-infos";
import { TabConversations } from "@/components/leads/lead-detail-sheet/tab-conversations";
import { TabNotes } from "@/components/leads/lead-detail-sheet/tab-notes";
import { LeadActions } from "@/components/leads/lead-detail-sheet/lead-actions";

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onPatch,
  onRemove,
  initialTab,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (id: string, patch: Partial<Lead>) => void;
  onRemove: (id: string) => void;
  /** Onglet à afficher à l'ouverture (ex. "conversations" pour répondre). */
  initialTab?: string;
}) {
  const [tab, setTab] = useState("infos");

  // À chaque (ré)ouverture ou changement de lead, on repositionne l'onglet.
  useEffect(() => {
    if (open) setTab(initialTab ?? "infos");
  }, [open, lead?.id, initialTab]);

  function handleStatus(status: LeadStatus) {
    if (!lead) return;
    onPatch(lead.id, { status });
    updateLeadStatus(lead.id, status).then((res) => {
      if (!res.ok) toast.error("Échec du changement de statut", { description: res.error });
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Les variantes data-[side=right] du kit (w-3/4, max-w-sm) priment sur
        // un simple w-full : on les vise explicitement.
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[600px]"
      >
        {lead && (
          <>
            <div className="border-b border-[var(--hairline)] px-5 pb-4 pt-5 sm:px-6">
              <SheetTitle className="sr-only">{fullName(lead.first_name, lead.last_name, lead.whatsapp_name)}</SheetTitle>
              <SheetDescription className="sr-only">Détail et édition du lead</SheetDescription>
              <LeadDetailHeader lead={lead} onStatusChange={handleStatus} />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList className="mx-5 mt-4 w-auto sm:mx-6 group-data-horizontal/tabs:h-11">
                <TabsTrigger value="infos">Infos</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <TabsContent value="infos">
                  <TabInfos lead={lead} onPatch={(patch) => onPatch(lead.id, patch)} />
                </TabsContent>
                <TabsContent value="conversations">
                  <TabConversations lead={lead} onPatch={(patch) => onPatch(lead.id, patch)} />
                </TabsContent>
                <TabsContent value="notes">
                  <TabNotes
                    leadId={lead.id}
                    initialNotes={lead.notes}
                    onSaved={(notes) => onPatch(lead.id, { notes })}
                  />
                </TabsContent>
              </div>
            </Tabs>

            <div className="border-t border-[var(--hairline)] bg-white/50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <LeadActions
                lead={lead}
                onPatch={(patch) => onPatch(lead.id, patch)}
                onRemove={onRemove}
                onClose={() => onOpenChange(false)}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
