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
import { PropOfTheDayCard } from "@/components/command/PropOfTheDayCard";
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

export default function NbaPage() {
  const [filters, setFilters] = useState<NbaBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();

  const live = useQuery({
    queryKey: ["nba-live"],
    queryFn: async () => {
      const [gamesRes, propRes] = await Promise.all([
        fetch("/api/nba/games"),
        fetch("/api/nba/featured-prop"),
      ]);
      if (!gamesRes.ok) throw new Error("games");
      const games = await gamesRes.json();
      const featured = propRes.ok ? await propRes.json() : null;
      return { games, featured };
    },
    staleTime: 60_000,
  });

  const board = useQuery({
    queryKey: ["nba-board"],
    queryFn: async () => {
      const res = await fetch("/api/nba/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        players: NbaPlayerCard[];
        live?: boolean;
        source?: string;
        count?: number;
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

  const visiblePlayers = livePlayers.filter((card) =>
    filtered.some((p) => p.playerId === card.id),
  );

  return (
    <div>
      <PageHeader
        eyebrow="NBA"
        title="NBA Research Board"
        description="Live ESPN schedule, gamelogs, and Seraphim model projections. Compare our projected values to lines you see elsewhere."
        actions={
          <Link
            href="/parlay-builder"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105"
          >
            Parlay Builder{legs.length > 0 ? ` (${legs.length})` : ""}
          </Link>
        }
      />

      <section className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Live slate (ESPN)</h2>
          {live.data?.games?.date && (
            <span className="text-xs text-neutral-500">{live.data.games.date}</span>
          )}
        </div>

        {live.isLoading && <CardSkeleton rows={2} />}
        {live.isError && (
          <EmptyState title="Couldn’t load ESPN games" description="Check network / egress and retry." />
        )}
        {live.data && live.data.games.games.length === 0 && (
          <EmptyState
            title="No NBA games on ESPN’s current day"
            description="Off-season or idle day. Featured prop may use a recent slate fallback."
          />
        )}
        {live.data && live.data.games.games.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {live.data.games.games.map(
              (g: {
                id: string;
                shortName: string;
                statusDetail: string;
                tipoffAt: string;
                home: { score?: number };
                away: { score?: number };
              }) => (
                <div
                  key={g.id}
                  className="rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-500/25"
                >
                  <p className="text-sm font-semibold text-white">{g.shortName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {g.statusDetail}
                    {g.home.score != null ? ` · ${g.away.score}-${g.home.score}` : ""}
                  </p>
                  <p className="mt-2 text-[11px] text-neutral-600">
                    {new Date(g.tipoffAt).toLocaleString()}
                  </p>
                </div>
              ),
            )}
          </div>
        )}

        {live.data?.featured?.ok && live.data.featured.prop && (
          <PropOfTheDayCard prop={live.data.featured.prop} />
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          card={{
            id: "nba-props",
            label: "Props on board",
            value: String(filtered.length),
            delta: board.data?.live ? "Live warehouse" : "Loading…",
            deltaTone: board.data?.live ? "up" : "neutral",
            hint: "After current filters",
          }}
        />
        <StatCard
          card={{
            id: "nba-ev",
            label: "Avg model EV",
            value: `+${avgEv.toFixed(1)}%`,
            delta: "vs comparison line",
            deltaTone: "up",
            hint: "Seraphim model estimate",
          }}
        />
        <StatCard
          card={{
            id: "nba-builder",
            label: "Legs in builder",
            value: String(legs.length),
            delta: legs.length ? "Ready to price" : "Empty slip",
            deltaTone: legs.length ? "up" : "neutral",
            hint: "Shared draft across pages",
          }}
        />
      </div>

      <div className="mt-6">
        <NbaFiltersBar filters={filters} onChange={setFilters} resultCount={filtered.length} />
      </div>

      {board.isLoading && (
        <div className="mt-6">
          <CardSkeleton rows={4} />
          <p className="mt-3 text-center text-xs text-neutral-500">
            Building live NBA board from ESPN gamelogs (first load can take a minute)…
          </p>
        </div>
      )}
      {board.isError && (
        <div className="mt-6">
          <EmptyState
            title="Live board unavailable"
            description="Start the data platform (`npm run data-platform`) and refresh."
          />
        </div>
      )}

      {!board.isLoading && !board.isError && (
        <>
          <div className="mt-6">
            <NbaPlayerCards
              players={visiblePlayers.length ? visiblePlayers : livePlayers}
              props={liveProps}
            />
          </div>
          <div className="mt-6">
            {filtered.length === 0 ? (
              <EmptyState
                title="No props match filters"
                description="Lower min confidence or clear team/market filters."
              />
            ) : (
              <NbaPropTable rows={filtered} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
