import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  nflMarketOptions,
  nflTeamOptions,
  type NflMarket,
  type NflSortKey,
} from "@/data/nflMock";

export interface NflBoardFilters {
  query: string;
  market: NflMarket | "All";
  team: string;
  side: "All" | "Over" | "Under";
  minConfidence: number;
  sortKey: NflSortKey;
  sortDir: "asc" | "desc";
}

export function NflFiltersBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: NflBoardFilters;
  onChange: (next: NflBoardFilters) => void;
  resultCount: number;
}) {
  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full max-w-md">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder="Player, team, or opponent…"
              className="h-11 w-full rounded-xl border border-[#1a1a1a] bg-[#111] pl-10 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-yellow-500/40 focus:ring-2 focus:ring-yellow-500/15"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Market"
            value={filters.market}
            options={nflMarketOptions}
            onChange={(market) => onChange({ ...filters, market: market as NflMarket | "All" })}
          />
          <FilterSelect
            label="Team"
            value={filters.team}
            options={[...nflTeamOptions]}
            onChange={(team) => onChange({ ...filters, team })}
          />
          <FilterSelect
            label="Side"
            value={filters.side}
            options={["All", "Over", "Under"]}
            onChange={(side) => onChange({ ...filters, side: side as NflBoardFilters["side"] })}
          />
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Min confidence
            </label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-[#1a1a1a] bg-[#111] px-3">
              <input
                type="range"
                min={60}
                max={95}
                value={filters.minConfidence}
                onChange={(e) => onChange({ ...filters, minConfidence: Number(e.target.value) })}
                className="w-24 accent-yellow-400"
              />
              <span className="w-8 text-sm tabular-nums text-yellow-400">{filters.minConfidence}</span>
            </div>
          </div>
          <FilterSelect
            label="Sort by"
            value={filters.sortKey}
            options={[
              { value: "ev", label: "EV" },
              { value: "confidence", label: "Confidence" },
              { value: "noVig", label: "No-Vig" },
              { value: "l10", label: "L10" },
              { value: "player", label: "Player" },
              { value: "line", label: "Line" },
            ]}
            onChange={(sortKey) => onChange({ ...filters, sortKey: sortKey as NflSortKey })}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                sortDir: filters.sortDir === "desc" ? "asc" : "desc",
              })
            }
            className="h-11 rounded-xl border border-[#1a1a1a] bg-[#111] px-4 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            {filters.sortDir === "desc" ? "High → Low" : "Low → High"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#151515] pt-3">
        <p className="text-xs text-neutral-500">
          Showing <span className="text-neutral-300">{resultCount}</span> NFL props · Week 12 mock
        </p>
        <button
          type="button"
          className="text-xs font-medium text-yellow-500/90 hover:text-yellow-400"
          onClick={() =>
            onChange({
              query: "",
              market: "All",
              team: "All",
              side: "All",
              minConfidence: 60,
              sortKey: "ev",
              sortDir: "desc",
            })
          }
        >
          Reset filters
        </button>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 rounded-xl border border-[#1a1a1a] bg-[#111] px-3 text-sm text-neutral-200 outline-none",
          "focus:border-yellow-500/40",
        )}
      >
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
