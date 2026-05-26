"use client";

import { useEffect, useRef, useState } from "react";

import { formatEur, formatNumber } from "@/lib/format";

type Format = "int" | "eur";

export function AnimatedNumber({
  value,
  format = "int",
  className,
  durationMs = 900,
}: {
  value: number;
  format?: Format;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const rounded = Math.round(display);
  const text = format === "eur" ? formatEur(rounded) : formatNumber(rounded);

  return <span className={className}>{text}</span>;
}
