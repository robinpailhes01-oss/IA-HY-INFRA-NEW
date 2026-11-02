import { Check, CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Liste d'alertes en verre clair. Le cockpit (/) passe désormais par le brief
// de Léa ; ce composant reste disponible pour une liste d'alertes simple.

export type AlertSeverity = "danger" | "warning" | "info";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
};

const SEVERITY: Record<AlertSeverity, { icon: LucideIcon; chip: string }> = {
  danger: { icon: CircleAlert, chip: "bg-[rgba(224,77,85,0.1)] text-danger" },
  warning: { icon: TriangleAlert, chip: "bg-[rgba(217,130,43,0.12)] text-warning" },
  info: { icon: Info, chip: "bg-[rgba(47,127,224,0.1)] text-ocean" },
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="vitre-inset flex items-center gap-3 rounded-[20px] p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[rgba(15,159,110,0.1)] text-success">
          <Check className="size-4" />
        </span>
        <p className="text-[13.5px] text-ink-2">Aucune alerte, tout est sous contrôle.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const config = SEVERITY[alert.severity];
        const Icon = config.icon;
        return (
          <li key={alert.id} className="vitre-inset flex items-start gap-3 rounded-[20px] p-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", config.chip)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13.5px] font-semibold tracking-[-0.012em] text-foreground">{alert.title}</p>
              <p className="text-[12px] text-ink-2">{alert.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
