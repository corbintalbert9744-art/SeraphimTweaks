import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { NbaFiltersBar, type NbaBoardFilters } from "@/components/nba/NbaFiltersBar";
import { NbaPropTable } from "@/components/nba/NbaPropTable";
import { NbaPlayerCards } from "@/components/nba/NbaPlayerCards";
import { PickemAppGate, PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import { usePickemApp } from "@/context/PickemAppContext";
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
  minConfidence: 0,
  sortKey: "edge",
  sortDir: "desc",
};

function sortProps(rows: NbaProp[], filters: NbaBoardFilters): NbaProp[] {
  const dir = filters.sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (filters.sortKey) {
      case "edge":
      case "bestValue": {
        const ae = a.edgePercent ?? a.edgeVsLine ?? 0;
        const be = b.edgePercent ?? b.edgeVsLine ?? 0;
        return (ae - be) * dir;
      }
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

export type SportResearchBoardProps = {
  league: string;
  title: string;
  description: string;
  propsPath: string;
  queryKey: string;
  emptyHint?: string;
  headerExtra?: ReactNode;
};

/** Shared premium research board — gated by pick'em app selection. */
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
  const { appId, app, ready } = usePickemApp();

  const boardUrl = useMemo(() => {
    if (!appId) return null;
    const url = new URL(propsPath, "http://local");
    url.searchParams.set("platform", appId);
    return `${url.pathname}${url.search}`;
  }, [propsPath, appId]);

  const board = useQuery({
    queryKey: [queryKey, appId],
    enabled: Boolean(ready && appId && boardUrl),
    queryFn: async () => {
      const res = await fetch(boardUrl!);
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        players?: NbaPlayerCard[];
        live?: boolean;
        source?: string;
        count?: number;
        note?: string | null;
        platformLabel?: string | null;
        updatedAt?: string | null;
        propsUpdatedAt?: string | null;
        syncedAt?: string | null;
        requiresApiKey?: boolean;
        requiresConfiguration?: boolean;
        error?: string;
        disclaimer?: string;
        rateLimited?: boolean;
        cached?: boolean;
        fallback?: boolean;
        fallbackSource?: string | null;
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
  const isFallback = Boolean(board.data?.fallback);

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

  const avgEdgePct =
    filtered.length === 0
      ? 0
      : filtered.reduce((sum, p) => {
          const pct = p.edgePercent ?? 0;
          return sum + pct;
        }, 0) / filtered.length;
  const overCount = filtered.filter((p) => p.side === "Over").length;
  const underCount = filtered.filter((p) => p.side === "Under").length;

  if (!ready) {
    return (
      <div className="mt-6">
        <CardSkeleton rows={3} />
      </div>
    );
  }

  if (!appId) {
    return (
      <div>
        <PageHeader eyebrow={league} title={title} description={description} />
        <div className="mt-8">
          <PickemAppGate />
        </div>
      </div>
    );
  }

  const loading = board.isLoading && liveProps.length === 0;
  const needsConfig =
    (board.data?.requiresApiKey || board.data?.requiresConfiguration) && liveProps.length === 0;
  const rateLimited = Boolean(board.data?.rateLimited);
  // Member-safe copy only — never surface vendor names, API keys, or quota text.
  const memberEmpty =
    emptyHint ||
    `${app?.name ?? "Platform"} lines for ${league} aren’t available right now. Check back shortly.`;
  const note = rateLimited
    ? liveProps.length > 0
      ? `Showing the latest saved ${app?.name ?? "platform"} lines while the live feed refreshes.`
      : memberEmpty
    : needsConfig
      ? memberEmpty
      : board.data?.note && !/API_KEY|PropLine|free-tier|ODDS_|SHARPAPI|PROPLINE/i.test(board.data.note)
        ? board.data.note
        : liveProps.length === 0
          ? memberEmpty
          : null;
  const platformLabel = board.data?.platformLabel ?? app?.name ?? null;
  const updatedAt = board.data?.propsUpdatedAt ?? board.data?.updatedAt ?? board.data?.syncedAt;

  return (
    <div>
      <PageHeader
        eyebrow={league}
        title={title}
        description={
          isFallback
            ? `${description} Research slate active while live ${app?.name ?? "app"} lines sync.`
            : `${description} Live ${app?.name ?? "app"} props only — model runs after the platform feed loads.`
        }
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PickemAppSwitcher />
        {updatedAt && (
          <p className="text-[11px] tabular-nums text-neutral-500" data-feature="props-updated-at">
            Props updated {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {note && liveProps.length > 0 && (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-neutral-400">
          {note}
        </p>
      )}

      {loading ? (
        <div className="mt-6">
          <CardSkeleton rows={4} />
        </div>
      ) : needsConfig ? (
        <div className="mt-6">
          <EmptyState title={`No ${app?.name ?? "platform"} lines yet`} description={memberEmpty} />
        </div>
      ) : board.isError ? (
        <div className="mt-6">
          <EmptyState
            title={`${league} board unavailable`}
            description="This board is temporarily unavailable. Please try again in a few minutes."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              card={{
                id: `${league}-props`,
                label: isFallback ? "Research props" : `${app?.shortName ?? "App"} props`,
                value: String(filtered.length),
                delta: board.isFetching
                  ? "Refreshing…"
                  : isFallback
                    ? "ESPN slate fallback"
                    : `${liveProps.length} on platform`,
                deltaTone: "neutral",
                hint: isFallback ? "Research slate" : platformLabel || "Platform board",
              }}
            />
            <StatCard
              card={{
                id: `${league}-edge`,
                label: "Avg edge %",
                value: `${avgEdgePct >= 0 ? "+" : ""}${avgEdgePct.toFixed(1)}%`,
                delta: "vs platform line",
                deltaTone: avgEdgePct >= 0 ? "up" : "down",
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
                title={`No ${app?.name ?? "platform"} lines yet`}
                description={memberEmpty}
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
                  minConfidenceFloor={0}
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
                  title={`${league} · ${app?.shortName ?? "App"} board`}
                  subtitle="Player · stat · line · projection · edge % · confidence"
                  platformLabel={platformLabel}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
