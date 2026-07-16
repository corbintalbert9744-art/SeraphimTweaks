import { useMemo, useState } from "react";
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
  minConfidence: 50,
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

export default function NbaPage() {
  const [filters, setFilters] = useState<NbaBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();
  const { appId, app, ready } = usePickemApp();

  const board = useQuery({
    queryKey: ["nba-board", appId],
    enabled: Boolean(ready && appId),
    queryFn: async () => {
      const res = await fetch(`/api/nba/props?platform=${encodeURIComponent(appId!)}`);
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        players: NbaPlayerCard[];
        live?: boolean;
        source?: string;
        count?: number;
        note?: string | null;
        platformLabel?: string | null;
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

  const avgEdgePct =
    filtered.length === 0
      ? 0
      : filtered.reduce((sum, p) => {
          const pct =
            p.edgePercent ??
            (p.projectedValue != null && p.line
              ? ((p.projectedValue - p.line) / p.line) * 100
              : 0);
          return sum + pct;
        }, 0) / filtered.length;

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
        <PageHeader
          eyebrow="NBA"
          title="NBA Research Board"
          description="Choose your pick'em app first — we only load that platform's available players and lines."
        />
        <div className="mt-8">
          <PickemAppGate />
        </div>
      </div>
    );
  }

  const platformLabel = board.data?.platformLabel ?? app?.name ?? null;
  const note = board.data?.note;

  return (
    <div>
      <PageHeader
        eyebrow="NBA"
        title="NBA Research Board"
        description={`Seraphim projections vs ${app?.name ?? "your app"} lines only — players not on that board stay hidden.`}
        actions={
          <Link
            href="/parlay-builder"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105"
          >
            Parlay Builder{legs.length > 0 ? ` (${legs.length})` : ""}
          </Link>
        }
      />

      <div className="mt-4">
        <PickemAppSwitcher />
      </div>

      {note && (
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200/90">
          {note}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          card={{
            id: "nba-props",
            label: `${app?.shortName ?? "App"} props`,
            value: String(filtered.length),
            delta: board.data?.live ? "Platform board" : "Loading…",
            deltaTone: board.data?.live ? "up" : "neutral",
            hint: "Available on selected app",
          }}
        />
        <StatCard
          card={{
            id: "nba-edge",
            label: "Avg edge %",
            value: `${avgEdgePct >= 0 ? "+" : ""}${avgEdgePct.toFixed(1)}%`,
            delta: "vs platform line",
            deltaTone: avgEdgePct >= 0 ? "up" : "down",
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
            Loading {app?.name} NBA board…
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
          {livePlayers.length > 0 && (
            <div className="mt-6">
              <NbaPlayerCards players={livePlayers} props={liveProps} />
            </div>
          )}
          <div className="mt-6">
            {filtered.length === 0 ? (
              <EmptyState
                title={`No ${app?.name ?? "platform"} props`}
                description={
                  note ||
                  "Sync market lines for this app, then refresh. We never invent pick'em boards from another database."
                }
              />
            ) : (
              <NbaPropTable
                rows={filtered}
                title={`NBA · ${app?.shortName ?? "App"} board`}
                subtitle="Player · stat · line · projection · edge % · confidence"
                platformLabel={platformLabel}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
