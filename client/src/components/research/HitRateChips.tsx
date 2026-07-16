import { cn } from "@/lib/utils";
import { hitToneClass, parseHitRate, type HitWindow } from "./hitRate";

const WINDOWS: HitWindow[] = ["L5", "L10", "L20", "Season"];

export type HitRateValues = {
  l5?: string;
  l10?: string;
  l20?: string;
  season?: string;
};

export function HitRateChips({
  rates,
  active,
  onSelect,
  size = "md",
  className,
}: {
  rates: HitRateValues;
  active?: HitWindow;
  onSelect?: (w: HitWindow) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const map: Record<HitWindow, string | undefined> = {
    L5: rates.l5,
    L10: rates.l10,
    L20: rates.l20,
    Season: rates.season,
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} data-feature="hit-rate-chips">
      {WINDOWS.map((w) => {
        const parsed = parseHitRate(map[w]);
        const isActive = active === w;
        const interactive = Boolean(onSelect);
        const Comp = interactive ? "button" : "div";
        return (
          <Comp
            key={w}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onSelect?.(w) : undefined}
            className={cn(
              "rounded-md border tabular-nums transition",
              size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
              parsed.pct >= 65
                ? "border-emerald-500/25 bg-emerald-500/15"
                : parsed.pct >= 50
                  ? "border-white/[0.08] bg-white/[0.04]"
                  : parsed.pct > 0
                    ? "border-red-500/20 bg-red-500/10"
                    : "border-transparent bg-transparent",
              hitToneClass(parsed.pct),
              isActive && "ring-1 ring-yellow-400/50 border-yellow-500/40",
              interactive && "cursor-pointer hover:border-yellow-500/30",
            )}
          >
            <span className="font-medium text-neutral-500">{w}</span>{" "}
            <span className="font-semibold">{parsed.pct ? `${parsed.pct}%` : "—"}</span>
          </Comp>
        );
      })}
    </div>
  );
}

export function HitRateMatrixCell({ value }: { value?: string }) {
  const parsed = parseHitRate(value);
  return (
    <div className="text-right">
      <p className={cn("text-sm font-semibold tabular-nums", hitToneClass(parsed.pct))}>
        {parsed.pct ? `${parsed.pct}%` : "—"}
      </p>
      <p className="text-[10px] tabular-nums text-neutral-600">{parsed.label}</p>
    </div>
  );
}
