import { createClient } from "@/lib/supabase/server";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import type { AnalyticsSnapshot } from "@/lib/analytics";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // Source : notre propre traqueur (fonction track-pageview), pas Vercel Web
  // Analytics — jamais activé côté site, et limité à 30 jours d'historique sur
  // le plan actuel. La vue expose exactement la forme attendue ci-dessous.
  const { data } = await supabase
    .from("site_daily_snapshots")
    .select("snapshot_date, visitors, pageviews, top_referrers, top_pages")
    .order("snapshot_date", { ascending: false })
    .limit(400);

  const snapshots = (data ?? []) as unknown as AnalyticsSnapshot[];

  return (
    <div className="space-y-6">
      <header className="enter-up space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          D&apos;où viennent les visiteurs de harmonie-yacht.fr, et comment le trafic évolue.
          Mesure sans cookie ni adresse IP, conservée sans limite de durée.
        </p>
      </header>

      <AnalyticsView snapshots={snapshots} />
    </div>
  );
}
