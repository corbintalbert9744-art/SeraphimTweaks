import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { NbaFiltersBar, type NbaBoardFilters } from "@/components/nba/NbaFiltersBar";
import { NbaPropTable } from "@/components/nba/NbaPropTable";
import { PickemAppGate, PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import { usePickemApp } from "@/context/PickemAppContext";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { parseHitRate, type NbaProp } from "@/data/nbaMock";
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
        players?: unknown[];
        live?: boolean;
        source?: string;
        count?: number;
        note?: string | null;
        platformLabel?: string | null;
        updatedAt?: string | null;
        propsUpdatedAt?: string | null;
        syncedAt?: string | null;
        requiresApiKey?: boolean;
      }>;
    },
    staleTime: 120_000,
  });

  const liveProps = useMemo(() => {
    const rows = (board.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
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
        <PageHeader
          eyebrow="NBA"
          title="NBA Props"
          description="Choose your pick'em app first — we only load that platform's available players and lines."
        />
        <div className="mt-8">
          <PickemAppGate />
        </div>
      </div>
    );
  }

  const platformLabel = board.data?.platformLabel ?? app?.name ?? null;
  const rawNote = board.data?.note ?? "";
  const memberSafeNote =
    rawNote && !/API_KEY|PropLine|free-tier|ODDS_|SHARPAPI|PROPLINE/i.test(rawNote)
      ? rawNote
      : null;
  const memberEmpty = `${app?.name ?? "Platform"} lines aren’t available right now. Check back shortly.`;
  const updatedAt = board.data?.propsUpdatedAt ?? board.data?.updatedAt ?? board.data?.syncedAt;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-500/80">NBA</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">NBA Props</h1>
          <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
            Live {app?.name ?? "app"} props · Seraphim projections
          </p>
        </div>
        <Link
          href="/parlay-builder"
          className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-yellow-300"
        >
          Parlay{legs.length > 0 ? ` · ${legs.length}` : ""}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PickemAppSwitcher />
        {updatedAt && (
          <p className="text-[11px] tabular-nums text-neutral-500" data-feature="props-updated-at">
            Updated {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {memberSafeNote && liveProps.length > 0 && (
        <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-neutral-400">
          {memberSafeNote}
        </p>
      )}

      <div className="mt-4">
        <NbaFiltersBar filters={filters} onChange={setFilters} resultCount={filtered.length} />
      </div>

      {board.isLoading && (
        <div className="mt-4">
          <CardSkeleton rows={4} />
        </div>
      )}
      {board.isError && (
        <div className="mt-4">
          <EmptyState
            title="Live board unavailable"
            description="This board is temporarily unavailable. Please try again in a few minutes."
          />
        </div>
      )}

      {!board.isLoading && !board.isError && (
        <div className="mt-3">
          {filtered.length === 0 ? (
            <EmptyState
              title={`No ${app?.name ?? "platform"} props`}
              description={memberSafeNote || memberEmpty}
            />
          ) : (
            <NbaPropTable
              rows={filtered}
              title="NBA Props"
              subtitle={`${filtered.length} props · ${overCount} OVER · ${underCount} UNDER`}
              platformLabel={platformLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}
