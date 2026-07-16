import { cn } from "@/lib/utils";
import { hitToneClass, parseHitRate } from "./hitRate";

/** Color-coded hit % chip matching research-desk refs (green / gold / red bordered). */
export function HitPctChip({
  value,
  className,
}: {
  value?: string | number | null;
  className?: string;
}) {
  const pct =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.includes("/")
        ? parseHitRate(value).pct
        : Number(value ?? 0);

  const tone =
    pct >= 70
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : pct >= 50
        ? "border-yellow-500/35 bg-yellow-500/10 text-yellow-300"
        : pct > 0
          ? "border-red-500/35 bg-red-500/10 text-red-300"
          : "border-[#2a2a2a] bg-[#111] text-neutral-600";

  return (
    <span
      className={cn(
        "inline-flex min-w-[2.75rem] items-center justify-center rounded-md border px-1.5 py-1 text-xs font-semibold tabular-nums",
        tone,
        className,
      )}
    >
      {pct > 0 ? `${pct}%` : "—"}
    </span>
  );
}

export function EvPlusBadge({
  ev,
  className,
}: {
  ev: number;
  className?: string;
}) {
  if (!Number.isFinite(ev) || ev < 4) {
    return <span className={cn("text-xs text-neutral-600", className)}>—</span>;
  }
  const strong = ev >= 12;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        strong
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400/90",
        className,
      )}
    >
      {strong ? "Strong EV+ " : "EV+ "}
      {ev > 0 ? "+" : ""}
      {ev.toFixed(0)}%
    </span>
  );
}

export function HitRateSummaryBoxes({
  windows,
  activeKey,
  onSelect,
  className,
}: {
  windows: Array<{
    key: string;
    label: string;
    hitPct: number;
    average: number | null;
    hits?: string;
  }>;
  activeKey?: string;
  onSelect?: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-0.5", className)} data-feature="hit-rate-summary">
      {windows.map((w) => {
        const active = activeKey === w.key;
        return (
          <button
            key={w.key}
            type="button"
            onClick={() => onSelect?.(w.key)}
            className={cn(
              "min-w-[5.5rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition",
              active
                ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                : "border-[#222] bg-[#0c0c0c] hover:border-[#333]",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {w.label}
            </p>
            <p className={cn("mt-1 text-sm font-semibold tabular-nums", hitToneClass(w.hitPct))}>
              HR {w.hitPct}%
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-neutral-400">
              Avg {w.average != null ? w.average.toFixed(1) : "—"}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function MarketTabs({
  markets,
  activeIndex,
  onSelect,
  className,
}: {
  markets: Array<{ id: string; label: string; line?: number }>;
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-0 overflow-x-auto border-b border-[#1a1a1a] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      data-feature="market-tabs"
      role="tablist"
    >
      {markets.map((m, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={cn(
              "relative shrink-0 px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wide transition",
              active ? "text-emerald-300" : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {m.label}
            {m.line != null ? (
              <span className="ml-1.5 tabular-nums opacity-70">{m.line}</span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-400" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function NoVigOddsCard({
  overPct,
  vigPct = 5,
  side = "Over",
  className,
}: {
  overPct: number;
  vigPct?: number;
  side?: "Over" | "Under";
  className?: string;
}) {
  const lean = side === "Under" ? 100 - overPct : overPct;
  const label = side === "Under" ? "UNDER" : "OVER";
  return (
    <div
      className={cn("rounded-xl border border-[#222] bg-[#0c0c0c] p-4", className)}
      data-feature="novig-odds-card"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          No-vig odds
        </p>
        <span className="text-[10px] tabular-nums text-neutral-500">VIG {vigPct.toFixed(1)}%</span>
      </div>
      <div
        className={cn(
          "mt-3 rounded-lg border px-3 py-3 text-center",
          lean >= 52
            ? "border-emerald-500/35 bg-emerald-500/10"
            : lean <= 48
              ? "border-red-500/35 bg-red-500/10"
              : "border-[#2a2a2a] bg-[#111]",
        )}
      >
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            lean >= 52 ? "text-emerald-300" : lean <= 48 ? "text-red-300" : "text-white",
          )}
        >
          {label} {lean.toFixed(1)}%
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className={cn(
              "h-full rounded-full",
              lean >= 52 ? "bg-emerald-400" : lean <= 48 ? "bg-red-400" : "bg-neutral-500",
            )}
            style={{ width: `${Math.min(100, Math.max(0, lean))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function BookLineStrip({
  books,
  className,
}: {
  books: Array<{
    book: string;
    line: number;
    odds?: number | string;
    evPct?: number | null;
    highlight?: boolean;
  }>;
  className?: string;
}) {
  if (!books.length) return null;
  return (
    <div
      className={cn("flex gap-2 overflow-x-auto pb-1", className)}
      data-feature="book-line-strip"
    >
      {books.map((b) => (
        <div
          key={b.book}
          className={cn(
            "min-w-[6.5rem] shrink-0 rounded-xl border px-3 py-2.5",
            b.highlight
              ? "border-emerald-500/35 bg-emerald-500/[0.07]"
              : "border-[#222] bg-[#0c0c0c]",
          )}
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {b.book}
          </p>
          <p className="mt-1 text-base font-semibold tabular-nums text-white">{b.line}</p>
          <p className="text-[11px] tabular-nums text-neutral-400">
            {b.odds != null ? String(b.odds) : "—"}
          </p>
          {b.evPct != null && Number.isFinite(b.evPct) ? (
            <p
              className={cn(
                "mt-1 text-[10px] font-semibold tabular-nums",
                b.evPct >= 0 ? "text-emerald-300" : "text-red-300",
              )}
            >
              EV {b.evPct > 0 ? "+" : ""}
              {b.evPct.toFixed(1)}%
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
