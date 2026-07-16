import { useMemo, useState, type ReactNode } from "react";
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
  minConfidence: 40,
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
      case "bestValue": {
        // Prefer larger positive edge (model projection vs market line)
        const ae = a.edgeVsLine ?? 0;
        const be = b.edgeVsLine ?? 0;
        return (ae - be) * dir;
      }
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

export type SportResearchBoardProps = {
  league: string;
  title: string;
  description: string;
  propsPath: string;
  queryKey: string;
  emptyHint?: string;
  headerExtra?: ReactNode;
};

/** Shared premium research board — same layout for WNBA, MLB, NHL, Soccer, Tennis. */
export function SportResearchBoard({
  league,
  title,
  description,
  propsPath,
  queryKey,
  emptyHint,
  headerExtra,
}: SportResearchBoardProps) {
  const [filters, setFilters] = useState<NbaBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();

  const board = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetch(propsPath);
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        players?: NbaPlayerCard[];
        live?: boolean;
        source?: string;
        count?: number;
        note?: string | null;
        requiresApiKey?: boolean;
        requiresConfiguration?: boolean;
        error?: string;
        disclaimer?: string;
      }>;
    },
    staleTime: 120_000,
    retry: 1,
  });

  const liveProps = useMemo(() => {
    const rows = (board.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
    return rows;
  }, [board.data?.props]);

  const livePlayers = board.data?.players ?? [];

  const marketOptions = useMemo(() => {
    const fromApi = (board.data as { markets?: string[] } | undefined)?.markets;
    if (fromApi?.length) return fromApi;
    const set = new Set<string>(["All"]);
    for (const p of liveProps) set.add(p.market);
    return Array.from(set);
  }, [board.data, liveProps]);

  const teamOptions = useMemo(() => {
    const fromApi = (board.data as { teams?: string[] } | undefined)?.teams;
    if (fromApi?.length) return fromApi;
    const set = new Set<string>(["All"]);
    for (const p of liveProps) if (p.team) set.add(p.team);
    return Array.from(set);
  }, [board.data, liveProps]);

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
  const overCount = filtered.filter((p) => p.side === "Over").length;
  const underCount = filtered.filter((p) => p.side === "Under").length;

  const loading = board.isLoading && liveProps.length === 0;
  const needsConfig =
    (board.data?.requiresApiKey || board.data?.requiresConfiguration) && liveProps.length === 0;
  const note = board.data?.note ?? board.data?.error;

  return (
    <div>
      <PageHeader
        eyebrow={league}
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {headerExtra}
            <Link
              href="/parlay-builder"
              className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
            >
              Parlay Builder{legs.length > 0 ? ` (${legs.length})` : ""}
            </Link>
          </div>
        }
      />

      {note && (
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200/90">
          {note}
        </p>
      )}

      {loading ? (
        <div className="mt-6">
          <CardSkeleton rows={4} />
        </div>
      ) : needsConfig ? (
        <div className="mt-6">
          <EmptyState
            title="Provider configuration required"
            description={
              emptyHint ||
              note ||
              `${league} needs a configured data provider. We do not fabricate live data.`
            }
          />
        </div>
      ) : board.isError ? (
        <div className="mt-6">
          <EmptyState
            title={`${league} board unavailable`}
            description="Start the data platform (`npm run data-platform`) so providers can sync."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              card={{
                id: `${league}-props`,
                label: "Props on board",
                value: String(filtered.length),
                delta: board.isFetching ? "Refreshing…" : `${liveProps.length} live`,
                deltaTone: "neutral",
                hint: "Warehouse + model",
              }}
            />
            <StatCard
              card={{
                id: `${league}-ev`,
                label: "Avg EV (filtered)",
                value: `+${avgEv.toFixed(1)}%`,
                delta: "vs comparison line",
                deltaTone: "up",
                hint: "Seraphim estimate",
              }}
            />
            <StatCard
              card={{
                id: `${league}-over`,
                label: "OVER leans",
                value: String(overCount),
                delta: "Green",
                deltaTone: "up",
                hint: "Model recommends Over",
              }}
            />
            <StatCard
              card={{
                id: `${league}-under`,
                label: "UNDER leans",
                value: String(underCount),
                delta: "Red",
                deltaTone: "down",
                hint: "Model recommends Under",
              }}
            />
          </div>

          {liveProps.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={`No ${league} props yet`}
                description={
                  emptyHint ||
                  `No slate with enough gamelog history right now — sync the warehouse or check back when providers have a card.`
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-6">
                <NbaFiltersBar
                  filters={filters}
                  onChange={setFilters}
                  resultCount={filtered.length}
                  marketOptions={marketOptions}
                  teamOptions={teamOptions}
                  leagueLabel={league}
                  minConfidenceFloor={40}
                />
              </div>
              {livePlayers.length > 0 && (
                <div className="mt-6">
                  <NbaPlayerCards players={livePlayers} props={liveProps} />
                </div>
              )}
              <div className="mt-6">
                <NbaPropTable
                  rows={filtered}
                  title={`${league} Prop Board`}
                  subtitle="Green OVER · red UNDER · open any row for Line Comparison (PrizePicks, FanDuel, DraftKings, …)"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
