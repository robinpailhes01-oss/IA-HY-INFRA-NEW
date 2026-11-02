import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Num } from "@/components/ui/num";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { MIN_READABLE, pathOf, type PageInfo } from "@/components/seo/model";

// CE QUE VOIT GOOGLE — les chiffres bruts du dernier passage, puis la table
// page par page. Une valeur en rouge est une valeur sous le seuil où un
// moteur (ou une IA) décroche ; le reste reste neutre, pas de vert partout.

function Stat({ value, unit, label, bad }: { value: string; unit: string; label: string; bad: boolean }) {
  return (
    <div className="vitre-inset min-w-0 rounded-[18px] px-3.5 py-3">
      <p className="flex items-baseline gap-1">
        <Num className={cn("n-inline text-[20px] tracking-[-0.03em]", bad ? "text-danger" : "text-foreground")}>{value}</Num>
        <span className="text-[12px] font-medium text-ink-3">{unit}</span>
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{label}</p>
    </div>
  );
}

export function PagesTable({ pages }: { pages: PageInfo[] }) {
  const home = pages[0];
  const reachable = pages.filter((p) => p.status === 200);
  const uniqueTitles = new Set(reachable.map((p) => p.title).filter(Boolean)).size;
  const h1Total = reachable.reduce((s, p) => s + p.h1Count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ce que voit Google en arrivant sur ton site</CardTitle>
        <CardDescription>Les chiffres bruts du dernier passage, puis page par page.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat
            value={`${reachable.length}/${pages.length}`}
            unit="pages"
            label="répondent correctement"
            bad={reachable.length < pages.length}
          />
          <Stat
            value={String(uniqueTitles)}
            unit={uniqueTitles > 1 ? "titres" : "titre"}
            label={`distincts pour ${reachable.length} pages analysées`}
            bad={uniqueTitles < reachable.length}
          />
          <Stat
            value={String(h1Total)}
            unit="titres H1"
            label="sur l'ensemble des pages"
            bad={reachable.some((p) => p.h1Count === 0)}
          />
          {home && (
            <Stat value={formatNumber(Math.round(home.bytes / 1024))} unit="Ko" label="de code envoyé aux moteurs" bad={false} />
          )}
        </div>

        {pages.length > 0 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-ink-3">
                  <th className="pb-2.5 pr-3 font-medium">Page</th>
                  <th className="w-px whitespace-nowrap pb-2.5 pr-3 text-right font-medium">
                    Texte<span className="hidden sm:inline"> lisible</span>
                  </th>
                  <th className="w-px pb-2.5 pr-3 text-right font-medium">H1</th>
                  <th className="hidden pb-2.5 pr-3 font-medium md:table-cell">Titre affiché dans Google</th>
                  <th className="w-px pb-2.5 text-right font-medium">Réponse</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => {
                  const ok = p.status === 200;
                  const thin = p.textLength < MIN_READABLE;
                  return (
                    <tr key={p.url} className="border-t border-[var(--hairline)]">
                      <td className="max-w-0 py-3 pr-3">
                        <span className="block truncate font-medium text-foreground">{pathOf(p.url) === "/" ? "Accueil" : pathOf(p.url)}</span>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-right">
                        <Num className={cn("n-inline", thin ? "text-danger" : "text-foreground")}>
                          {formatNumber(p.textLength)}
                        </Num>
                        <span className="ml-1 hidden text-[11.5px] text-ink-3 sm:inline">car.</span>
                      </td>
                      <td className={cn("py-3 pr-3 text-right tabular-nums", p.h1Count === 0 ? "text-danger" : "text-ink-2")}>
                        {p.h1Count}
                      </td>
                      <td className="hidden max-w-0 py-3 pr-3 text-ink-2 md:table-cell md:w-[42%]">
                        <span className="block truncate">{p.title || "—"}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={cn(
                            "pastille",
                            ok ? "bg-[rgba(15,159,110,0.1)] text-success" : "bg-[rgba(224,77,85,0.1)] text-danger",
                          )}
                        >
                          {p.status || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
