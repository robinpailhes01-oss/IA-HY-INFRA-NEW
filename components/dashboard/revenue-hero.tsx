import { Calendar, HandCoins, type LucideIcon } from "lucide-react";

import { AnimatedNumber } from "@/components/dashboard/animated-number";

function SubStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/90">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-white/60">{label}</p>
        <AnimatedNumber
          value={value}
          format="eur"
          className="text-lg font-semibold tracking-tight text-white"
        />
      </div>
    </div>
  );
}

export function RevenueHero({
  year,
  caYtd,
  caMonth,
  outstanding,
}: {
  year: number;
  caYtd: number;
  caMonth: number;
  outstanding: number;
}) {
  return (
    <div className="enter-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[#163251] to-[#0d2540] p-6 text-white shadow-[0_24px_60px_-24px_rgba(16,24,40,0.45)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-gold/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-12 size-64 rounded-full bg-info/15 blur-3xl"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-white/70">
            Chiffre d&apos;affaires {year}
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-inset ring-white/15">
            depuis le 1ᵉʳ janvier
          </span>
        </div>

        <div className="mt-2 flex items-baseline">
          <AnimatedNumber
            value={caYtd}
            format="int"
            durationMs={1200}
            className="text-4xl font-semibold tracking-tight sm:text-5xl"
          />
          <span className="ml-1.5 text-2xl font-semibold text-white/40 sm:text-3xl">
            ,00&nbsp;€
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
          <SubStat icon={Calendar} label="Ce mois-ci" value={caMonth} />
          <div className="sm:border-l sm:border-white/10 sm:pl-4">
            <SubStat icon={HandCoins} label="Reste à encaisser" value={outstanding} />
          </div>
        </div>
      </div>
    </div>
  );
}
