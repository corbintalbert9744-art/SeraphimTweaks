import { cn } from "@/lib/utils";
import { parseHitRate, type HitWindow } from "./hitRate";

export type HitHistoryPoint = {
  label: string;
  value: number | null;
  hit: boolean;
  opponent?: string;
};

export function HitRateBars({
  history,
  line,
  window,
  windowLabel,
  className,
  compact = false,
}: {
  history: HitHistoryPoint[];
  line: number;
  window: HitWindow;
  windowLabel?: string;
  className?: string;
  compact?: boolean;
}) {
  const limit = window === "L5" ? 5 : window === "L10" ? 10 : window === "L20" ? 20 : history.length;
  const slice = history.slice(0, Math.max(limit, 0));
  if (!slice.length) {
    return (
      <p className={cn("text-neutral-500", compact ? "py-2 text-xs" : "text-sm")}>
        Hit-rate history fills as gamelogs land.
      </p>
    );
  }
  const vals = slice.map((h) => h.value ?? 0);
  const max = Math.max(...vals, line, 1) * 1.15;
  const hits = slice.filter((g) => g.hit).length;
  const rate = parseHitRate(`${hits}/${slice.length}`);

  return (
    <div className={cn(className)} data-feature="hit-rate-bars">
      {!compact && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Hit rate · {windowLabel ?? window}
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl">
              {hits}
              <span className="text-neutral-600">/{slice.length}</span>
            </p>
            <p className="mt-1.5 text-sm text-neutral-500">
              {rate.pct}% cleared line {line} in the last {slice.length} games
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" /> Hit
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-red-500/80" /> Miss
            </span>
          </div>
        </div>
      )}
      {compact && (
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span>
            {windowLabel ?? window}: {hits}/{slice.length} · {rate.pct}%
          </span>
          <span className="tabular-nums">Line {line}</span>
        </div>
      )}

      <div className={cn("relative", compact ? "h-28" : "h-52 sm:h-60")}>
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `${(line / max) * 100}%` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-yellow-500/40" />
          {!compact && (
            <span className="ml-3 shrink-0 rounded-md border border-yellow-500/20 bg-[#0d0d0d] px-2 py-0.5 text-[11px] font-medium text-yellow-400/90">
              Line {line}
            </span>
          )}
        </div>

        <div className="absolute inset-0 flex items-end justify-between gap-1 px-0.5">
          {slice.map((g, i) => {
            const v = g.value ?? 0;
            const h = Math.max(compact ? 6 : 8, (v / max) * 100);
            return (
              <div key={`${g.label}-${i}`} className="group flex h-full flex-1 flex-col items-center justify-end">
                {!compact && (
                  <span className="mb-1 hidden text-[10px] tabular-nums text-neutral-400 opacity-0 transition group-hover:opacity-100 sm:block">
                    {v.toFixed(1)}
                  </span>
                )}
                <div
                  className={cn(
                    "w-full rounded-t-sm transition",
                    compact ? "max-w-[18px]" : "max-w-[28px]",
                    g.hit ? "bg-emerald-400" : "bg-red-500/80",
                  )}
                  style={{ height: `${h}%` }}
                  title={`${g.label}: ${v}${g.opponent ? ` vs ${g.opponent}` : ""}`}
                />
                {!compact && (
                  <span className="mt-1.5 max-w-full truncate text-[9px] text-neutral-600">{g.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
