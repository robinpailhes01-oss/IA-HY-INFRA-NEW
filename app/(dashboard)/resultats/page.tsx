import { Inbox, MessageSquare, Euro, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// Les crédits IA réels (hub_credit_ledger) sont affichés multipliés par ce
// facteur — valeur d'usage retail, pas le coût brut payé au fournisseur.
const CREDIT_DISPLAY_MULTIPLIER = 25;

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp_baileys: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export default async function ResultatsPage() {
  const supabase = await createClient();

  const [leadsRes, waSentRes, emailLogRes, revenuesRes, creditLedgerRes] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("from_me", true),
    supabase.from("email_log").select("*", { count: "exact", head: true }),
    supabase.from("revenues").select("amount"),
    supabase.from("hub_credit_ledger").select("channel_type, credits"),
  ]);

  const demandesTraitees = leadsRes.count ?? 0;
  const messagesWhatsapp = waSentRes.count ?? 0;
  const messagesEmail = emailLogRes.count ?? 0;
  const messagesTotal = messagesWhatsapp + messagesEmail;

  const caGenere = (revenuesRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  const ledger = creditLedgerRes.data ?? [];
  const creditsBase = ledger.reduce((s, r) => s + Number(r.credits ?? 0), 0);
  const creditsAffiches = creditsBase * CREDIT_DISPLAY_MULTIPLIER;

  const byChannel = Object.entries(
    ledger.reduce<Record<string, number>>((acc, r) => {
      const key = r.channel_type ?? "autre";
      acc[key] = (acc[key] ?? 0) + Number(r.credits ?? 0) * CREDIT_DISPLAY_MULTIPLIER;
      return acc;
    }, {}),
  )
    .map(([channel, credits]) => ({ channel, credits }))
    .sort((a, b) => b.credits - a.credits);
  const maxChannelCredits = byChannel[0]?.credits ?? 1;

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Résultats</h1>
        <p className="text-sm text-muted-foreground">
          Ce que Léa a accompli depuis le début — vue d&apos;ensemble globale.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Demandes traitées"
          value={demandesTraitees}
          format="int"
          icon={Inbox}
          accent="primary"
          index={0}
        />
        <KpiCard
          label="Messages envoyés"
          value={messagesTotal}
          format="int"
          icon={MessageSquare}
          accent="info"
          hint={`${formatNumber(messagesWhatsapp)} WhatsApp · ${formatNumber(messagesEmail)} email`}
          index={1}
        />
        <KpiCard
          label="CA généré"
          value={caGenere}
          format="eur"
          icon={Euro}
          accent="success"
          index={2}
        />
        <KpiCard
          label="Crédits IA consommés"
          value={creditsAffiches}
          format="int"
          icon={Sparkles}
          accent="gold"
          index={3}
        />
      </div>

      <Card className="enter-up" style={{ animationDelay: "280ms" }}>
        <CardHeader>
          <CardTitle>Crédits IA par canal</CardTitle>
          <CardDescription>Total {formatNumber(creditsAffiches)} crédits</CardDescription>
        </CardHeader>
        <CardContent>
          {byChannel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée d&apos;usage pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {byChannel.map((c) => (
                <li key={c.channel} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                    <span className="font-medium text-foreground">{formatNumber(c.credits)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full bg-gold/70")}
                      style={{ width: `${pct(c.credits, maxChannelCredits)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
