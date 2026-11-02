import { Globe, MousePointerClick, Search, Sparkles } from "lucide-react";

import { PlatformGlyph } from "@/components/social/platform-glyph";
import { cn } from "@/lib/utils";
import type { SourceGlyphKind } from "@/components/analytics/sources";

/**
 * La pastille ronde d'une source : la marque quand on la reconnaît, sinon une
 * icône sobre dans la gamme maritime. Les IA portent l'indigo — la couleur
 * des leads, parce que c'est ce qu'on attend d'elles.
 */
export function SourceGlyph({ kind, className }: { kind: SourceGlyphKind; className?: string }) {
  const inner =
    kind === "instagram" || kind === "facebook" || kind === "tiktok" || kind === "whatsapp" ? (
      <PlatformGlyph platform={kind} className="size-4" />
    ) : kind === "search" ? (
      <Search className="size-4 text-ocean" />
    ) : kind === "ai" ? (
      <Sparkles className="size-4 text-indigo" />
    ) : kind === "direct" ? (
      <MousePointerClick className="size-4 text-ink-3" />
    ) : (
      <Globe className="size-4 text-ink-3" />
    );

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-[var(--shadow-glass)]",
        className,
      )}
    >
      {inner}
    </span>
  );
}
