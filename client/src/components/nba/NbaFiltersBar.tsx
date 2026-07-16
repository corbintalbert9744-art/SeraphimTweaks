import {
  ResearchFiltersBar,
  type ResearchFilterState,
} from "@/components/research";
import {
  nbaMarketOptions,
  nbaTeamOptions,
  type NbaMarket,
  type NbaSortKey,
} from "@/data/nbaMock";

export interface NbaBoardFilters {
  query: string;
  market: NbaMarket | "All" | string;
  team: string;
  side: "All" | "Over" | "Under";
  minConfidence: number;
  sortKey: NbaSortKey;
  sortDir: "asc" | "desc";
}

const SORT_OPTIONS: Array<{ value: NbaSortKey; label: string }> = [
  { value: "edge", label: "Model edge" },
  { value: "ev", label: "Expected value" },
  { value: "confidence", label: "Confidence" },
  { value: "researchScore", label: "Research Score" },
  { value: "projection", label: "Projection" },
  { value: "bestValue", label: "Best value" },
  { value: "noVig", label: "No-vig" },
  { value: "l10", label: "L10 hit %" },
  { value: "player", label: "Player" },
  { value: "line", label: "Line" },
];

export function NbaFiltersBar({
  filters,
  onChange,
  resultCount,
  marketOptions,
  teamOptions,
  leagueLabel = "NBA",
  minConfidenceFloor = 40,
  minConfidenceCeiling = 95,
}: {
  filters: NbaBoardFilters;
  onChange: (next: NbaBoardFilters) => void;
  resultCount: number;
  marketOptions?: string[];
  teamOptions?: string[];
  leagueLabel?: string;
  minConfidenceFloor?: number;
  minConfidenceCeiling?: number;
}) {
  const markets = ["All", ...(marketOptions?.length ? marketOptions : [...nbaMarketOptions])];
  const teams = ["All", ...(teamOptions?.length ? teamOptions : [...nbaTeamOptions])];

  const state: ResearchFilterState = {
    query: filters.query,
    market: String(filters.market),
    team: filters.team,
    side: filters.side,
    minConfidence: filters.minConfidence,
    sortKey: filters.sortKey,
    sortDir: filters.sortDir,
  };

  return (
    <ResearchFiltersBar
      filters={state}
      onChange={(next) =>
        onChange({
          query: next.query,
          market: next.market,
          team: next.team,
          side: next.side,
          minConfidence: next.minConfidence,
          sortKey: next.sortKey as NbaSortKey,
          sortDir: next.sortDir,
        })
      }
      resultCount={resultCount}
      marketOptions={markets}
      teamOptions={teams}
      sortOptions={SORT_OPTIONS}
      leagueLabel={leagueLabel}
      minConfidenceFloor={minConfidenceFloor}
      minConfidenceCeiling={minConfidenceCeiling}
      sticky
    />
  );
}
