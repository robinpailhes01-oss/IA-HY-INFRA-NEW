import { createClient } from "@/lib/supabase/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import type { AnalyticsSnapshot } from "@/lib/analytics";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("analytics_daily_snapshots")
    .select("snapshot_date, visitors, pageviews, top_referrers, top_pages")
    .order("snapshot_date", { ascending: false })
    .limit(400);

  const snapshots = (data ?? []) as unknown as AnalyticsSnapshot[];

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Historique des visites du site harmonie-yacht.fr — au-delà des 30 jours gardés par
          Vercel, archivé ici chaque jour pour ne jamais perdre la tendance.
        </p>
      </header>

      <AnalyticsView snapshots={snapshots} />
    </div>
  );
}
