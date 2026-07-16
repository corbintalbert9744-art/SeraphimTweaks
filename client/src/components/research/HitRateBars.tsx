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
}: {
  history: HitHistoryPoint[];
  line: number;
  window: HitWindow;
  windowLabel?: string;
  className?: string;
}) {
  const limit = window === "L5" ? 5 : window === "L10" ? 10 : window === "L20" ? 20 : history.length;
  const slice = history.slice(0, Math.max(limit, 0));
  if (!slice.length) {
    return <p className="text-sm text-neutral-500">Hit-rate history fills as gamelogs land.</p>;
  }
  const vals = slice.map((h) => h.value ?? 0);
  const max = Math.max(...vals, line, 1) * 1.15;
  const hits = slice.filter((g) => g.hit).length;
  const rate = parseHitRate(`${hits}/${slice.length}`);

  return (
    <div className={cn(className)} data-feature="hit-rate-bars">
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

      <div className="relative h-52 sm:h-60">
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `${(line / max) * 100}%` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-yellow-500/40" />
          <span className="ml-3 shrink-0 rounded-md border border-yellow-500/20 bg-[#0d0d0d] px-2 py-0.5 text-[11px] font-medium text-yellow-400/90">
            Line {line}
          </span>
        </div>

        <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-0.5">
          {slice.map((g, i) => {
            const v = g.value ?? 0;
            const h = Math.max(8, (v / max) * 100);
            return (
              <div key={`${g.label}-${i}`} className="group flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 hidden text-[10px] tabular-nums text-neutral-400 opacity-0 transition group-hover:opacity-100 sm:block">
                  {v.toFixed(1)}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[28px] rounded-t-sm transition",
                    g.hit ? "bg-emerald-400" : "bg-red-500/80",
                  )}
                  style={{ height: `${h}%` }}
                  title={`${g.label}: ${v}${g.opponent ? ` vs ${g.opponent}` : ""}`}
                />
                <span className="mt-1.5 max-w-full truncate text-[9px] text-neutral-600">{g.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
