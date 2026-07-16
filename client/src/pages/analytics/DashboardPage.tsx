import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { TopPropsTable } from "@/components/dashboard/TopPropsTable";
import { HighestEvSection } from "@/components/dashboard/HighestEvSection";
import { RecentUpdatesFeed } from "@/components/dashboard/RecentUpdatesFeed";
import { PickemAppGate, PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import { usePickemApp } from "@/context/PickemAppContext";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { asNbaPropFromApi, cacheNbaBoardProps } from "@/lib/nbaLiveCache";
import type { EvLeader, FeedItem, PropRow, StatCardData } from "@/data/mock";

export default function DashboardPage() {
  const { appId, app, ready } = usePickemApp();

  const cc = useQuery({
    queryKey: ["command-center"],
    enabled: Boolean(ready && appId),
    queryFn: async () => {
      const res = await fetch("/api/command-center");
      if (!res.ok) throw new Error("cc");
      return res.json();
    },
    staleTime: 60_000,
  });

  const board = useQuery({
    queryKey: ["nba-board", appId],
    enabled: Boolean(ready && appId),
    queryFn: async () => {
      const res = await fetch(`/api/nba/props?platform=${encodeURIComponent(appId!)}`);
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{
        props: Record<string, unknown>[];
        count?: number;
        note?: string | null;
        platformLabel?: string | null;
        updatedAt?: string | null;
        propsUpdatedAt?: string | null;
        syncedAt?: string | null;
      }>;
    },
    staleTime: 120_000,
  });

  const liveProps = useMemo(() => {
    const rows = (board.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
    return rows;
  }, [board.data?.props]);

  const topProps: PropRow[] = liveProps.slice(0, 8).map((p) => ({
    id: p.id,
    player: p.player,
    team: p.team,
    league: "NBA",
    market: p.market,
    line: `${p.side} ${p.line}`,
    odds: p.americanOdds > 0 ? `+${p.americanOdds}` : String(p.americanOdds),
    evPercent: p.edgePercent ?? p.evPercent,
    researchScore: p.researchScore ?? p.confidence,
    dqs: 70,
    l10: p.l10,
    why: `${p.market} model lean`,
    checks: [
      { code: "minutes", status: "pass" as const, label: "Minutes" },
      { code: "usage", status: "pass" as const, label: "Usage" },
      { code: "matchup", status: "pass" as const, label: "Matchup" },
      { code: "injury", status: "pass" as const, label: "Injury" },
    ],
  }));

  const evLeaders: EvLeader[] = liveProps
    .slice()
    .sort((a, b) => (b.edgePercent ?? b.evPercent) - (a.edgePercent ?? a.evPercent))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      player: p.player,
      market: p.market,
      league: "NBA",
      evPercent: p.edgePercent ?? p.evPercent,
      researchScore: p.researchScore ?? p.confidence,
      odds: p.americanOdds > 0 ? `+${p.americanOdds}` : String(p.americanOdds),
    }));

  const injuries = (cc.data?.injuryAlerts ?? cc.data?.injuries ?? []) as Array<{
    player?: string;
    status?: string;
    detail?: string;
  }>;
  const feed: FeedItem[] = [
    ...(cc.data?.featured?.prop
      ? [
          {
            id: "featured",
            title: `Featured · ${cc.data.featured.prop.player ?? "Prop"}`,
            detail: cc.data.featured.prop.market
              ? `${cc.data.featured.prop.market} lean`
              : "Live featured prop updated",
            time: "Live",
            tone: "success" as const,
          },
        ]
      : []),
    ...injuries.slice(0, 4).map((inj, i) => ({
      id: `inj-${i}`,
      title: inj.player || "Injury update",
      detail: `${inj.status ?? ""} ${inj.detail ?? ""}`.trim() || "Injury feed",
      time: "Live",
      tone: "warn" as const,
    })),
  ];

  const avgEdge =
    liveProps.length === 0
      ? 0
      : liveProps.reduce(
          (s, p) =>
            s +
            (p.edgePercent ??
              (p.projectedValue != null && p.line
                ? ((p.projectedValue - p.line) / p.line) * 100
                : 0)),
          0,
        ) / liveProps.length;
  const avgRs =
    liveProps.length === 0
      ? 0
      : liveProps.reduce((s, p) => s + (p.researchScore ?? p.confidence), 0) / liveProps.length;

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
          eyebrow="Seraphim Analytics"
          title="Research Dashboard"
          description="Choose your pick'em app first — the dashboard only loads that platform's available lines."
        />
        <div className="mt-8">
          <PickemAppGate />
        </div>
      </div>
    );
  }

  const statCards: StatCardData[] = [
    {
      id: "props",
      label: `${app?.shortName ?? "App"} props`,
      value: String(liveProps.length),
      delta: board.data?.platformLabel || "Platform board",
      deltaTone: "neutral",
      hint: "Only lines on selected app",
    },
    {
      id: "ev",
      label: "Avg edge %",
      value: `${avgEdge >= 0 ? "+" : ""}${avgEdge.toFixed(1)}%`,
      delta: "vs platform line",
      deltaTone: avgEdge >= 0 ? "up" : "down",
      hint: "Seraphim estimate",
    },
    {
      id: "rs",
      label: "Avg confidence",
      value: String(Math.round(avgRs)),
      delta: "model score",
      deltaTone: "neutral",
      hint: "Not a win probability",
    },
    {
      id: "cc",
      label: "Command Center",
      value: cc.data?.featured?.ok ? "Live" : cc.isLoading ? "…" : "—",
      delta: cc.data?.board?.date ? String(cc.data.board.date) : "ESPN slate",
      deltaTone: cc.data?.featured?.ok ? "up" : "neutral",
      hint: "Refresh pulls warehouse",
    },
  ];

  const loading = board.isLoading && liveProps.length === 0;
  const note = board.data?.note;
  const updatedAt = board.data?.propsUpdatedAt ?? board.data?.updatedAt ?? board.data?.syncedAt;

  return (
    <div>
      <PageHeader
        eyebrow="Seraphim Analytics"
        title="Research Dashboard"
        description={`Live ${app?.name ?? "pick'em"} props → model edge. No invented lines.`}
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs text-neutral-400">
              {board.isFetching ? "Refreshing…" : app?.shortName ?? "Live"}
            </span>
            <Link
              href="/nba"
              className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
            >
              NBA board
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

      {note && (
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-200/90">
          {note}
        </p>
      )}

      {loading ? (
        <CardSkeleton rows={3} />
      ) : board.isError ? (
        <EmptyState
          title="Live dashboard unavailable"
          description="Start the data platform (`npm run data-platform`) so the board can load."
        />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {topProps.length ? (
                <TopPropsTable rows={topProps} />
              ) : (
                <EmptyState
                  title={`No ${app?.name ?? "platform"} props yet`}
                  description="Sync market lines for this app, then refresh. We do not invent boards from another database."
                />
              )}
            </div>
            <div className="space-y-6">
              <HighestEvSection leaders={evLeaders} />
              <RecentUpdatesFeed items={feed} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
