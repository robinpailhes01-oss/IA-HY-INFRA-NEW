import { CheckCircle2, ScanSearch, TriangleAlert, XCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Check } from "@/components/seo/model";

// LES CONTRÔLES — rouges d'abord, puis orange, puis ce qui est en place.
// Chaque point à corriger porte l'explication de l'Auditeur (le « pourquoi ») :
// Robin n'a pas à savoir ce qu'est une balise canonique, seulement pourquoi
// elle compte.

const TONE = {
  danger: { chip: "bg-[rgba(224,77,85,0.1)] text-danger", icon: <XCircle />, dot: "bg-danger" },
  warning: { chip: "bg-[rgba(217,130,43,0.12)] text-warning", icon: <TriangleAlert />, dot: "bg-warning" },
  success: { chip: "bg-[rgba(15,159,110,0.1)] text-success", icon: <CheckCircle2 />, dot: "bg-success" },
} as const;

export function ChecksCard({
  title,
  description,
  checks,
  tone,
  firstLabel,
}: {
  title: string;
  description: string;
  checks: Check[];
  tone: "danger" | "warning";
  /** Étiquette posée sur le premier point (« En premier »). */
  firstLabel?: string;
}) {
  const t = TONE[tone];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", t.dot)} />
          {title}
          <span className="text-[13px] font-normal text-ink-3">{checks.length}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {checks.map((c, i) => (
            <li key={c.key} className="flex gap-3 border-t border-[var(--hairline)] py-4 first:border-t-0 first:pt-1 last:pb-0">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4", t.chip)}>
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium tracking-[-0.01em] text-foreground">
                  {c.label}
                  {i === 0 && firstLabel && (
                    <span className="pastille bg-[linear-gradient(180deg,#183f6d,#0b2545)] text-white">{firstLabel}</span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{c.detail}</p>
                {c.why && (
                  <p className="vitre-inset mt-2.5 flex gap-2 rounded-[14px] px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
                    <ScanSearch className="mt-0.5 size-3.5 shrink-0 text-ocean" />
                    <span>{c.why}</span>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Ce qui est déjà en place : compact, sur deux colonnes, sans explication. */
export function PassedCard({ checks }: { checks: Check[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-success" />
          Déjà en place
          <span className="text-[13px] font-normal text-ink-3">{checks.length}</span>
        </CardTitle>
        <CardDescription>Ces points sont conformes — l&apos;Auditeur te préviendra s&apos;ils régressent.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.key} className="flex gap-3 border-t border-[var(--hairline)] py-3 sm:[&:nth-child(-n+2)]:border-t-0 first:border-t-0">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[rgba(15,159,110,0.1)] text-success [&_svg]:size-3.5">
                <CheckCircle2 />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-foreground">{c.label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
