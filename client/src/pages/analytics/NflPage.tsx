import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { NflFiltersBar, type NflBoardFilters } from "@/components/nfl/NflFiltersBar";
import { NflPropTable } from "@/components/nfl/NflPropTable";
import { SportPlayerCards } from "@/components/shared/SportPlayerCards";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { parseHitRate, type NflProp } from "@/data/nflMock";
import { buildSportPlayerCards } from "@/lib/playerResearchProfile";
import { cacheNflBoardProps } from "@/lib/addPropToBuilder";

const defaultFilters: NflBoardFilters = {
  query: "",
  market: "All",
  team: "All",
  side: "All",
  minConfidence: 50,
  sortKey: "ev",
  sortDir: "desc",
};

function asNflProp(row: Record<string, unknown>): NflProp {
  return {
    id: String(row.id),
    playerId: String(row.playerId ?? ""),
    player: String(row.player ?? ""),
    team: String(row.team ?? ""),
    opponent: String(row.opponent ?? ""),
    position: String(row.position ?? "SKILL"),
    market: row.market as NflProp["market"],
    side: row.side === "Under" ? "Under" : "Over",
    line: Number(row.line ?? 0),
    americanOdds: Number(row.americanOdds ?? -110),
    noVigProb: Number(row.noVigProb ?? 0.5),
    evPercent: Number(row.evPercent ?? 0),
    confidence: Number(row.confidence ?? 50),
    l5: String(row.l5 ?? "0/0"),
    l10: String(row.l10 ?? "0/0"),
    l20: String(row.l20 ?? "0/0"),
    season: String(row.season ?? "0/0"),
    tipTime: String(row.tipTime ?? ""),
    week: Number(row.week ?? 0),
    projectedSnapPct: Number(row.projectedSnapPct ?? 80),
    injury: (row.injury as NflProp["injury"]) || "None",
  };
}

function sortProps(rows: NflProp[], filters: NflBoardFilters): NflProp[] {
  const dir = filters.sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (filters.sortKey) {
      case "ev":
        return (a.evPercent - b.evPercent) * dir;
      case "confidence":
        return (a.confidence - b.confidence) * dir;
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

export default function NflPage() {
  const [filters, setFilters] = useState<NflBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();

  const board = useQuery({
    queryKey: ["nfl-board"],
    queryFn: async () => {
      const res = await fetch("/api/nfl/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        players: Array<Record<string, unknown>>;
        live?: boolean;
        count?: number;
      }>;
    },
    staleTime: 120_000,
  });

  const liveProps = useMemo(() => {
    const rows = (board.data?.props ?? []).map(asNflProp);
    if (rows.length) cacheNflBoardProps(rows);
    return rows;
  }, [board.data?.props]);

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

  const playerCards = useMemo(
    () =>
      buildSportPlayerCards(liveProps, {
        league: "NFL",
        cards: (board.data?.players ?? []).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? ""),
          team: String(c.team ?? ""),
          opponent: String(c.opponent ?? ""),
          position: String(c.position ?? ""),
          headshotInitials: String(c.headshotInitials ?? ""),
          confidence: Number(c.researchScore ?? c.confidence ?? 50),
          matchupNote: String(c.matchupNote ?? c.insight ?? ""),
          topPropId: String(c.topPropId ?? ""),
        })),
      }),
    [liveProps, board.data?.players],
  );

  const avgEv =
    filtered.length === 0
      ? 0
      : filtered.reduce((sum, p) => sum + p.evPercent, 0) / filtered.length;

  return (
    <div>
      <PageHeader
        eyebrow="NFL"
        title="NFL Research Board"
        description="Live ESPN schedule + Seraphim model projections. No mock slate."
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
            id: "nfl-props",
            label: "Props on board",
            value: String(filtered.length),
            delta: `${liveProps.length} live`,
            deltaTone: "neutral",
            hint: "After current filters",
          }}
        />
        <StatCard
          card={{
            id: "nfl-ev",
            label: "Avg EV (filtered)",
            value: `+${avgEv.toFixed(1)}%`,
            delta: "vs model",
            deltaTone: "up",
            hint: "Seraphim estimate",
          }}
        />
        <StatCard
          card={{
            id: "nfl-builder",
            label: "Legs in builder",
            value: String(legs.length),
            delta: legs.length ? "Ready to price" : "Empty slip",
            deltaTone: legs.length ? "up" : "neutral",
            hint: "Shared draft",
          }}
        />
      </div>

      <div className="mt-6">
        <NflFiltersBar filters={filters} onChange={setFilters} resultCount={filtered.length} />
      </div>

      {board.isLoading && (
        <div className="mt-6">
          <CardSkeleton rows={4} />
          <p className="mt-3 text-center text-xs text-neutral-500">
            Loading live NFL board from ESPN / warehouse…
          </p>
        </div>
      )}
      {board.isError && (
        <div className="mt-6">
          <EmptyState
            title="Live NFL board unavailable"
            description="Start the data platform (`npm run data-platform`) and refresh."
          />
        </div>
      )}

      {!board.isLoading && !board.isError && (
        <>
          <div className="mt-6">
            {playerCards.length ? (
              <SportPlayerCards players={playerCards} />
            ) : (
              <EmptyState
                title="No NFL players on slate"
                description="Off-season or no ESPN games with enough gamelog history yet."
              />
            )}
          </div>
          <div className="mt-6">
            {filtered.length === 0 ? (
              <EmptyState
                title="No props match filters"
                description="Lower min confidence or clear team/market filters."
              />
            ) : (
              <NflPropTable rows={filtered} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
