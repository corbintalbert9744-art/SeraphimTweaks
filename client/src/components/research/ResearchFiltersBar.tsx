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
        "rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]/95 p-3 backdrop-blur-md sm:p-4",
        sticky && "sticky top-16 z-20",
        className,
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full max-w-sm">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Search{leagueLabel ? ` · ${leagueLabel}` : ""}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder="Player, team, opponent…"
              className="h-10 w-full rounded-lg border border-[#1a1a1a] bg-[#111] pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-yellow-500/40 focus:ring-1 focus:ring-yellow-500/20"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
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
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Min conf
            </label>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[#1a1a1a] bg-[#111] px-2.5">
              <input
                type="range"
                min={minConfidenceFloor}
                max={minConfidenceCeiling}
                value={filters.minConfidence}
                onChange={(e) => onChange({ ...filters, minConfidence: Number(e.target.value) })}
                className="w-20 accent-yellow-400"
              />
              <span className="w-7 text-xs tabular-nums text-yellow-400">{filters.minConfidence}</span>
            </div>
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
            className="h-10 rounded-lg border border-[#1a1a1a] bg-[#111] px-3 text-xs font-medium text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            {filters.sortDir === "asc" ? "Asc" : "Desc"}
          </button>
          <div className="flex h-10 items-center rounded-lg border border-[#1a1a1a] bg-[#111] px-3 text-xs tabular-nums text-neutral-400">
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
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-[7.5rem] rounded-lg border border-[#1a1a1a] bg-[#111] px-2.5 text-xs text-neutral-200 outline-none focus:border-yellow-500/40"
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
