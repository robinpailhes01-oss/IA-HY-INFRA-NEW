import {
  CircleAlert,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type AlertSeverity = "danger" | "warning" | "info";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
};

const SEVERITY: Record<
  AlertSeverity,
  { icon: LucideIcon; wrap: string; icon_color: string }
> = {
  danger: {
    icon: CircleAlert,
    wrap: "border-danger/20 bg-danger/5",
    icon_color: "text-danger",
  },
  warning: {
    icon: TriangleAlert,
    wrap: "border-warning/20 bg-warning/5",
    icon_color: "text-warning",
  },
  info: {
    icon: Info,
    wrap: "border-info/20 bg-info/5",
    icon_color: "text-info",
  },
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Aucune alerte. Tout est sous contrôle. ⚓
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const config = SEVERITY[alert.severity];
        const Icon = config.icon;
        return (
          <li
            key={alert.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              config.wrap,
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", config.icon_color)} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{alert.title}</p>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
