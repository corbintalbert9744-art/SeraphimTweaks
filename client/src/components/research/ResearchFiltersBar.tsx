import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResearchFilterState = {
  query: string;
  market: string;
  team: string;
  side: "All" | "Over" | "Under";
  minConfidence: number;
  sortKey: string;
  sortDir: "asc" | "desc";
};

/**
 * Sticky, high-density filter rail for prop boards (OddsIQ-style workflow).
 */
export function ResearchFiltersBar({
  filters,
  onChange,
  resultCount,
  marketOptions,
  teamOptions,
  sortOptions,
  leagueLabel,
  minConfidenceFloor = 40,
  minConfidenceCeiling = 95,
  sticky = true,
  className,
}: {
  filters: ResearchFilterState;
  onChange: (next: ResearchFilterState) => void;
  resultCount: number;
  marketOptions: string[];
  teamOptions: string[];
  sortOptions: Array<{ value: string; label: string }>;
  leagueLabel?: string;
  minConfidenceFloor?: number;
  minConfidenceCeiling?: number;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <section
      data-feature="research-filters"
      className={cn(
        "rounded-lg border border-[var(--seraphim-border)] bg-[var(--seraphim-surface)]/95 px-2.5 py-2 backdrop-blur-md sm:px-3",
        sticky && "sticky top-16 z-20",
        className,
      )}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xs">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder={leagueLabel ? `Search ${leagueLabel}…` : "Search player…"}
              className="h-8 w-full rounded-md border border-[#1a1a1a] bg-[#111] pl-8 pr-3 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-yellow-500/40"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            label="Market"
            value={filters.market}
            options={marketOptions}
            onChange={(market) => onChange({ ...filters, market })}
          />
          <Select
            label="Team"
            value={filters.team}
            options={teamOptions}
            onChange={(team) => onChange({ ...filters, team })}
          />
          <Select
            label="Side"
            value={filters.side}
            options={["All", "Over", "Under"]}
            onChange={(side) => onChange({ ...filters, side: side as ResearchFilterState["side"] })}
          />
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-[#1a1a1a] bg-[#111] px-2">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
              Conf
            </span>
            <input
              type="range"
              min={minConfidenceFloor}
              max={minConfidenceCeiling}
              value={filters.minConfidence}
              onChange={(e) => onChange({ ...filters, minConfidence: Number(e.target.value) })}
              className="w-16 accent-yellow-400"
            />
            <span className="w-6 text-[11px] tabular-nums text-yellow-400">{filters.minConfidence}</span>
          </div>
          <Select
            label="Sort"
            value={filters.sortKey}
            options={sortOptions.map((o) => o.value)}
            labels={Object.fromEntries(sortOptions.map((o) => [o.value, o.label]))}
            onChange={(sortKey) => onChange({ ...filters, sortKey })}
          />
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc" })
            }
            className="h-8 rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 text-[11px] font-medium text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            {filters.sortDir === "asc" ? "Asc" : "Desc"}
          </button>
          <div className="flex h-8 items-center rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 text-[11px] tabular-nums text-neutral-400">
            {resultCount} props
          </div>
        </div>
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <label className="sr-only">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={label}
        className="h-8 min-w-[6.5rem] rounded-md border border-[#1a1a1a] bg-[#111] px-2 text-[11px] text-neutral-200 outline-none focus:border-yellow-500/40"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels?.[opt] ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}
