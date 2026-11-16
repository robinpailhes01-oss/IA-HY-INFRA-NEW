import { CalendarClock, CloudSun, HandCoins, MessageCircle, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

// Le récap du jour, tel que Léa l'a rédigé ce matin (fonction daily-recap) : la
// météo marine, les sorties, ce qui attend une réponse, l'argent à encaisser.
// On affiche le texte enregistré tel quel, découpé en rubriques — pas de second
// calcul ici : ce que Robin lit dans le tableau de bord est exactement ce que
// Léa a écrit (et envoyé, s'il y a un canal configuré).

type Section = { title: string; lines: string[] };

function parse(content: string): { heading: string; sections: Section[] } {
  const blocks = content.trim().split(/\n\s*\n/);
  const raw = (blocks.shift() ?? "").replace(/^[^\p{L}]+/u, "").trim();
  const heading = raw.charAt(0).toUpperCase() + raw.slice(1);
  const sections = blocks
    .map((b) => b.split("\n").filter((l) => l.trim().length > 0))
    .filter((l) => l.length > 0)
    .map((l) => ({ title: l[0].replace(/\s*·.*$/, "").trim(), lines: l.slice(1) }));
  return { heading, sections };
}

const ICON: Record<string, React.ReactNode> = {
  "Météo marine": <CloudSun />,
  Sorties: <CalendarClock />,
  "À traiter": <MessageCircle />,
  Argent: <HandCoins />,
};

export function DailyRecapCard({
  content,
  createdAt,
  className,
}: {
  content: string;
  /** Horodatage ISO de la rédaction. */
  createdAt: string;
  className?: string;
}) {
  const { heading, sections } = parse(content);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "2-digit" })
    .format(new Date(createdAt));

  return (
    <section aria-label="Récap du jour" className={cn("vitre rise rounded-[28px] p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-[rgba(47,127,224,0.1)] text-ocean [&_svg]:size-4">
          <Sparkles />
        </span>
        <div className="min-w-0">
          <p className="t-eyebrow text-ink-3">Récap du jour · {time}</p>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">{heading || "Récap"}</h2>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((s) => (
          <div key={s.title} className="min-w-0 rounded-[20px] bg-[rgba(11,37,69,0.035)] p-4">
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-foreground [&_svg]:size-4 [&_svg]:text-ocean">
              {ICON[s.title]}
              {s.title}
            </p>
            <ul className="space-y-1.5 text-[13px] leading-snug text-ink-2">
              {s.lines.map((l, i) => {
                const note = !l.trimStart().startsWith("•");
                return (
                  <li key={i} className={cn(note && "pl-3.5 text-[12px] text-ink-3")}>
                    {l.replace(/^\s*•\s*/, "")}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
