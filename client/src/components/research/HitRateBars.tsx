import { cn } from "@/lib/utils";
import { buildLast10Games } from "@/lib/legStats";
import { parseHitRate, type HitWindow } from "./hitRate";

export type HitHistoryPoint = {
  label: string;
  value: number | null;
  hit: boolean;
  opponent?: string;
};

function windowSampleCount(window: HitWindow, rate: string): number {
  if (window === "L5") return 5;
  if (window === "L10") return 10;
  if (window === "L20") return 20;
  const parsed = parseHitRate(rate);
  return Math.min(25, Math.max(8, parsed.samples || 10));
}

function synthesizeHistory(opts: {
  propId: string;
  rate: string;
  line: number;
  side: "Over" | "Under";
  window: HitWindow;
}): HitHistoryPoint[] {
  const n = windowSampleCount(opts.window, opts.rate);
  // Reuse deterministic builder (capped at 10), then extend for L20/Season.
  const base = buildLast10Games(opts.propId, opts.rate, opts.line, opts.side);
  if (base.length >= n) return base.slice(0, n).map((g) => ({ ...g, value: g.value }));
  const out: HitHistoryPoint[] = base.map((g) => ({ ...g, value: g.value }));
  let i = 0;
  while (out.length < n) {
    const src = base[i % Math.max(base.length, 1)];
    if (!src) break;
    out.push({
      label: src.label,
      opponent: src.opponent,
      value: src.value,
      hit: src.hit,
    });
    i += 1;
  }
  return out;
}

export function HitRateBars({
  history,
  line,
  window,
  windowLabel,
  className,
  compact = false,
  /** When warehouse gamelogs are missing, synthesize bars from the hit-rate string. */
  fallbackRate,
  propId,
  side = "Over",
}: {
  history: HitHistoryPoint[];
  line: number;
  window: HitWindow;
  windowLabel?: string;
  className?: string;
  compact?: boolean;
  fallbackRate?: string;
  propId?: string;
  side?: "Over" | "Under";
}) {
  const limit = window === "L5" ? 5 : window === "L10" ? 10 : window === "L20" ? 20 : Math.max(history.length, 12);
  let slice = history.slice(0, Math.max(limit, 0));
  const synthesized =
    !slice.length && fallbackRate && propId
      ? synthesizeHistory({
          propId,
          rate: fallbackRate,
          line,
          side,
          window,
        }).slice(0, limit)
      : [];
  if (!slice.length) slice = synthesized;

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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Hit rate · {windowLabel ?? window}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-white">
              {hits}
              <span className="text-neutral-600">/{slice.length}</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {rate.pct}% cleared line {line}
              {synthesized.length ? " · estimated from hit rate" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Hit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80" /> Miss
            </span>
          </div>
        </div>
      )}
      {compact && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span>
            {windowLabel ?? window}: {hits}/{slice.length} · {rate.pct}%
            {synthesized.length ? " · est." : ""}
          </span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Hit
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-red-500/80" /> Miss
            </span>
            <span className="tabular-nums">Line {line}</span>
          </span>
        </div>
      )}

      <div className={cn("relative", compact ? "h-32" : "h-44")}>
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `${(line / max) * 100}%` }}
        >
          <div className="h-px flex-1 border-t border-dashed border-yellow-500/40" />
          <span className="ml-2 shrink-0 rounded border border-yellow-500/20 bg-[#0d0d0d] px-1.5 py-0.5 text-[10px] font-medium text-yellow-400/90">
            {line}
          </span>
        </div>

        <div className="absolute inset-0 flex items-end justify-between gap-0.5 px-0.5 pb-4">
          {slice.map((g, i) => {
            const v = g.value ?? 0;
            const h = Math.max(compact ? 8 : 10, (v / max) * 100);
            return (
              <div key={`${g.label}-${i}`} className="group flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-0.5 text-[9px] tabular-nums text-neutral-500 opacity-0 transition group-hover:opacity-100">
                  {v.toFixed(1)}
                </span>
                <div
                  className={cn(
                    "w-full rounded-t-sm transition",
                    compact ? "max-w-[16px]" : "max-w-[22px]",
                    g.hit ? "bg-emerald-400" : "bg-red-500/80",
                  )}
                  style={{ height: `${h}%` }}
                  title={`${g.label}: ${v}${g.opponent ? ` vs ${g.opponent}` : ""}`}
                />
                <span className="mt-1 max-w-full truncate text-[8px] text-neutral-600">
                  {g.label.replace(/^@/, "")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
