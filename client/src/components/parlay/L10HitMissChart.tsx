import type { BuilderLeg } from "@/data/builderTypes";
import { cn } from "@/lib/utils";

export function L10HitMissChart({
  leg,
  className,
}: {
  leg: BuilderLeg;
  className?: string;
}) {
  const games = leg.last10;
  const maxVal = Math.max(...games.map((g) => g.value), leg.line) * 1.15;
  const hits = games.filter((g) => g.hit).length;
  const sideLabel = leg.side === "Over" ? `o${leg.line}` : `u${leg.line}`;

  return (
    <div className={cn("rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c] p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-yellow-500/30 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-xs font-semibold text-yellow-300">
            {leg.initials}
          </div>
          <div>
            <p className="font-semibold text-white">
              {leg.shortName} · {leg.marketCode}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Last {games.length} games vs {sideLabel}
            </p>
          </div>
        </div>
        <p className="text-right text-lg font-semibold tabular-nums text-yellow-400 sm:text-xl">
          {leg.l10Pct}% <span className="text-[11px] font-medium tracking-wider text-yellow-500/80">HIT RATE</span>
        </p>
      </div>

      <div className="relative mt-6 h-44">
        {/* Line threshold */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `${(leg.line / maxVal) * 100}%` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-neutral-500/70" />
          <span className="ml-2 shrink-0 rounded bg-[#0c0c0c] px-1.5 text-[10px] font-medium text-neutral-400">
            Line {leg.line}
          </span>
        </div>

        <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-1">
          {games.map((g, i) => {
            const heightPct = Math.max(8, (g.value / maxVal) * 100);
            return (
              <div key={`${g.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end">
                <span
                  className={cn(
                    "mb-1 text-[10px] font-semibold tabular-nums",
                    g.hit ? "text-emerald-300" : "text-red-300/80",
                  )}
                >
                  {g.value}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[28px] rounded-t-md transition-all duration-500",
                    g.hit
                      ? "bg-gradient-to-t from-emerald-700 to-emerald-400"
                      : "bg-gradient-to-t from-red-900/80 to-red-500/70",
                  )}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="mt-2 text-[9px] tabular-nums text-neutral-500">{g.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#1a1a1a] pt-4 text-xs">
        <p className="text-neutral-400">
          <span className="font-semibold text-neutral-200">
            {hits} of {games.length}
          </span>{" "}
          games cleared the line
        </p>
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Hit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400/80" /> Miss
          </span>
        </div>
      </div>
    </div>
  );
}
