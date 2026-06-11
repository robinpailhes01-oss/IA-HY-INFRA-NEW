"use client";

import { useState } from "react";
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
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (id: string, patch: Partial<Lead>) => void;
  onRemove: (id: string) => void;
}) {
  const [tab, setTab] = useState("infos");

  function handleStatus(status: LeadStatus) {
    if (!lead) return;
    onPatch(lead.id, { status });
    updateLeadStatus(lead.id, status).then((res) => {
      if (!res.ok) toast.error("Échec du changement de statut", { description: res.error });
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[600px]">
        {lead && (
          <>
            <div className="border-b border-border p-4 pr-12">
              <SheetTitle className="sr-only">{fullName(lead.first_name, lead.last_name, lead.whatsapp_name)}</SheetTitle>
              <SheetDescription className="sr-only">Détail et édition du lead</SheetDescription>
              <LeadDetailHeader lead={lead} onStatusChange={handleStatus} />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList className="mx-4 mt-3 w-auto">
                <TabsTrigger value="infos">Infos</TabsTrigger>
                <TabsTrigger value="conversations">Conversations</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
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

            <div className="border-t border-border p-4">
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
