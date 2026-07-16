import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { NbaFiltersBar, type NbaBoardFilters } from "@/components/nba/NbaFiltersBar";
import { NbaPropTable } from "@/components/nba/NbaPropTable";
import { NbaPlayerCards } from "@/components/nba/NbaPlayerCards";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { parseHitRate, type NbaPlayerCard, type NbaProp } from "@/data/nbaMock";
import { asNbaPropFromApi, cacheNbaBoardProps } from "@/lib/nbaLiveCache";

const defaultFilters: NbaBoardFilters = {
  query: "",
  market: "All",
  team: "All",
  side: "All",
  minConfidence: 50,
  sortKey: "edge",
  sortDir: "desc",
};

function sortProps(rows: NbaProp[], filters: NbaBoardFilters): NbaProp[] {
  const dir = filters.sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (filters.sortKey) {
      case "edge":
        return ((a.edgeVsLine ?? 0) - (b.edgeVsLine ?? 0)) * dir;
      case "ev":
        return (a.evPercent - b.evPercent) * dir;
      case "confidence":
        return (a.confidence - b.confidence) * dir;
      case "researchScore":
        return ((a.researchScore ?? a.confidence) - (b.researchScore ?? b.confidence)) * dir;
      case "projection":
        return ((a.projectedValue ?? a.line) - (b.projectedValue ?? b.line)) * dir;
      case "noVig":
        return (a.noVigProb - b.noVigProb) * dir;
      case "l10":
        return (parseHitRate(a.l10) - parseHitRate(b.l10)) * dir;
      case "line":
        return (a.line - b.line) * dir;
      case "player":
        return a.player.localeCompare(b.player) * dir;
      default:
        return 0;
    }
  });
}

export default function WnbaPage() {
  const [filters, setFilters] = useState<NbaBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();

  const board = useQuery({
    queryKey: ["wnba-board"],
    queryFn: async () => {
      const res = await fetch("/api/wnba/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        players: NbaPlayerCard[];
        live?: boolean;
        source?: string;
        count?: number;
        comparisonNote?: string;
      }>;
    },
    staleTime: 120_000,
  });

  const liveProps = useMemo(() => {
    const rows = (board.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
    return rows;
  }, [board.data?.props]);
  const livePlayers = board.data?.players ?? [];

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const rows = liveProps.filter((prop) => {
      if (filters.market !== "All" && prop.market !== filters.market) return false;
      if (filters.team !== "All" && prop.team !== filters.team) return false;
      if (filters.side !== "All" && prop.side !== filters.side) return false;
      if (prop.confidence < filters.minConfidence) return false;
      if (!q) return true;
      return (
        prop.player.toLowerCase().includes(q) ||
        prop.team.toLowerCase().includes(q) ||
        prop.opponent.toLowerCase().includes(q) ||
        prop.market.toLowerCase().includes(q)
      );
    });
    return sortProps(rows, filters);
  }, [filters, liveProps]);

  const avgEv =
    filtered.length === 0
      ? 0
      : filtered.reduce((sum, p) => sum + p.evPercent, 0) / filtered.length;

  const loading = board.isLoading && liveProps.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="WNBA"
        title="WNBA Research Board"
        description="Live ESPN slate + Seraphim projections. Line Comparison includes PrizePicks (placeholder until live pick'em adapter)."
        actions={
          <Link
            href="/parlay-builder"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Parlay Builder{legs.length > 0 ? ` (${legs.length})` : ""}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          card={{
            id: "wnba-props",
            label: "Props on board",
            value: String(filtered.length),
            delta: board.isFetching ? "Refreshing…" : `${liveProps.length} live`,
            deltaTone: "neutral",
            hint: "ESPN + model",
          }}
        />
        <StatCard
          card={{
            id: "wnba-ev",
            label: "Avg EV (filtered)",
            value: `+${avgEv.toFixed(1)}%`,
            delta: "vs comparison line",
            deltaTone: "up",
            hint: "Seraphim estimate",
          }}
        />
        <StatCard
          card={{
            id: "wnba-pp",
            label: "PrizePicks compare",
            value: "Ready",
            delta: "Line Comparison",
            deltaTone: "neutral",
            hint: "Open any prop for operator lines",
          }}
        />
      </div>

      {loading ? (
        <div className="mt-6">
          <CardSkeleton rows={4} />
        </div>
      ) : board.isError ? (
        <div className="mt-6">
          <EmptyState
            title="WNBA board unavailable"
            description="Start the data platform (`npm run data-platform`) so ESPN WNBA can sync."
          />
        </div>
      ) : liveProps.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No WNBA props yet"
            description="No slate games with enough gamelog history right now — check back when ESPN has tonight’s card, or force refresh."
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <NbaFiltersBar
              filters={filters}
              onChange={setFilters}
              resultCount={filtered.length}
            />
          </div>
          <div className="mt-6">
            <NbaPlayerCards players={livePlayers} props={liveProps} />
          </div>
          <div className="mt-6">
            <NbaPropTable rows={filtered} />
          </div>
        </>
      )}
    </div>
  );
}
