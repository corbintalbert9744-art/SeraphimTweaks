/**
 * Research Hub — projection vs live books (formerly Market Comparison).
 * Unavailable operators stay marked Unavailable; market data is never fabricated.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { propResearchPath } from "@/lib/playerLinks";
import { EvPlusBadge, summarizeMarketVsModel } from "@/components/research";
import { usePickemApp } from "@/context/PickemAppContext";
import { PickemAppGate, PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import { asPropDetailFromApi } from "@/lib/nbaLiveCache";
import type { LeagueCode } from "@/data/mock";
import { cn } from "@/lib/utils";

type BoardRow = {
  id: string;
  player: string;
  market: string;
  side: string;
  line: number;
  league: string;
  projectedValue?: number | null;
  overProbability?: number | null;
  underProbability?: number | null;
  confidence?: number | null;
  researchScore?: number | null;
  evPercent?: number | null;
  modelEdge?: number | null;
  bestValueBook?: string | null;
  bestEvBook?: string | null;
  connectedBookCount?: number | null;
  linesUpdatedAt?: string | null;
  books?: Array<{
    book: string;
    line: number;
    requiresIntegration?: boolean;
    isMock?: boolean;
    isBestValue?: boolean;
  }>;
};

const LEAGUES: Array<LeagueCode | "All"> = [
  "All",
  "NBA",
  "WNBA",
  "NFL",
  "MLB",
  "NHL",
  "Soccer",
  "ATP",
  "WTA",
];

async function fetchBoard(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(path);
  if (!res.ok) return [];
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return [];
  const data = (await res.json()) as { props?: Record<string, unknown>[] };
  return Array.isArray(data.props) ? data.props : [];
}

function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function ResearchHubPage() {
  const { appId, app, ready } = usePickemApp();
  const platform = appId || "prizepicks";
  const [league, setLeague] = useState<(typeof LEAGUES)[number]>("All");

  const board = useQuery({
    queryKey: ["research-hub-board", platform, league],
    enabled: ready,
    queryFn: async () => {
      const qs = platform ? `?platform=${encodeURIComponent(platform)}` : "";
      const paths =
        league === "All"
          ? [
              `/api/nba/props${qs}`,
              `/api/wnba/props${qs}`,
              `/api/nfl/props${qs}`,
              `/api/mlb/props${qs}`,
              `/api/nhl/props${qs}`,
            ]
          : [
              league === "NBA"
                ? `/api/nba/props${qs}`
                : league === "WNBA"
                  ? `/api/wnba/props${qs}`
                  : league === "NFL"
                    ? `/api/nfl/props${qs}`
                    : league === "MLB"
                      ? `/api/mlb/props${qs}`
                      : league === "NHL"
                        ? `/api/nhl/props${qs}`
                        : league === "Soccer"
                          ? `/api/soccer/props${qs}`
                          : `/api/tennis/props?tour=${league}${platform ? `&platform=${encodeURIComponent(platform)}` : ""}`,
            ];
      const batches = await Promise.all(paths.map(fetchBoard));
      const rows = batches
        .flat()
        .filter((row) => {
          // Client-side guard: never show research-slate / mock book rows.
          if (row.oddsAreMock === true) return false;
          const role = String(row.oddsRole || "").toLowerCase();
          if (role === "comparison-only" || role === "research" || role === "model-only") {
            return false;
          }
          const id = String(row.id || "").toLowerCase();
          if (id.includes(":pickem:")) return true;
          if (role === "platform-live" || role === "platform-board") return true;
          if (row.platform && (row.platformLine != null || row.line != null)) return true;
          return false;
        })
        .map((row) => {
        const detail = asPropDetailFromApi(row);
        return {
          id: detail.id,
          player: detail.player,
          market: detail.market,
          side: detail.recommendation ?? detail.side,
          line: detail.line,
          league: detail.league,
          projectedValue: detail.projectedValue ?? detail.line,
          overProbability: detail.overProbability ?? detail.noVigProb,
          underProbability: detail.underProbability ?? detail.noVigOpposite,
          confidence: detail.confidence,
          researchScore: detail.researchScore,
          evPercent: detail.evPercent,
          modelEdge: detail.modelEdge,
          bestValueBook: detail.bestValueBook,
          bestEvBook: detail.bestEvBook,
          connectedBookCount: detail.connectedBookCount,
          linesUpdatedAt: detail.linesUpdatedAt,
          books: detail.books,
        } satisfies BoardRow;
      });
      return rows;
    },
    staleTime: 90_000,
    refetchInterval: 300_000,
  });

  const rows = board.data ?? [];

  const ranked = useMemo(() => {
    return [...rows]
      .map((r) => {
        const projected = Number(r.projectedValue ?? r.line);
        const summary = summarizeMarketVsModel({
          projected,
          line: r.line,
          side: r.side === "Under" ? "Under" : "Over",
          overProbability: r.overProbability,
          underProbability: r.underProbability,
          confidence: r.confidence,
          researchScore: r.researchScore,
          evPercent: r.evPercent,
          books: r.books,
          bestLine: r.books?.find((b) => b.isBestValue && !b.requiresIntegration)?.line ?? null,
          bestLineBook: r.bestValueBook ?? r.bestEvBook ?? null,
          linesUpdatedAt: r.linesUpdatedAt,
          connectedCount: r.connectedBookCount ?? undefined,
        });
        return { row: r, summary };
      })
      .sort((a, b) => Math.abs(b.summary.modelEdge) - Math.abs(a.summary.modelEdge))
      .slice(0, 80);
  }, [rows]);

  if (!ready) {
    return (
      <div>
        <PageHeader
          eyebrow="Research"
          title="Research Hub"
          description="Proprietary projections against every connected betting provider."
        />
        <PickemAppGate />
      </div>
    );
  }

  const loading = board.isLoading && ranked.length === 0;

  return (
    <div data-feature="research-hub">
      <PageHeader
        eyebrow="Research"
        title="Research Hub"
        description={`Seraphim model vs live ${app?.name || "pick'em"} lines only — players currently listed on the betting site. Unavailable books stay blank.`}
        actions={<PickemAppSwitcher />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LEAGUES.map((lg) => (
          <button
            key={lg}
            type="button"
            onClick={() => setLeague(lg)}
            className={
              league === lg
                ? "rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-300"
                : "rounded-lg border border-transparent bg-white/[0.03] px-2.5 py-1 text-[11px] text-neutral-400 hover:border-white/10 hover:text-neutral-200"
            }
          >
            {lg}
          </button>
        ))}
      </div>

      {loading && <CardSkeleton rows={4} />}

      {!loading && ranked.length === 0 && (
        <EmptyState
          title="No live props to compare"
          description="Only players currently listed on the selected betting site appear here. Try another league or wait for the feed to refresh."
        />
      )}

      {ranked.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="border-b border-[#1a1a1a] bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Player</th>
                  <th className="px-3 py-2.5 font-medium">Market</th>
                  <th className="px-3 py-2.5 font-medium">Proj</th>
                  <th className="px-3 py-2.5 font-medium">Line</th>
                  <th className="px-3 py-2.5 font-medium">Model edge</th>
                  <th className="px-3 py-2.5 font-medium">P(Over/Under)</th>
                  <th className="px-3 py-2.5 font-medium">Conf</th>
                  <th className="px-3 py-2.5 font-medium">RS</th>
                  <th className="px-3 py-2.5 font-medium">EV</th>
                  <th className="px-3 py-2.5 font-medium">Best line</th>
                  <th className="px-3 py-2.5 font-medium">Books</th>
                  <th className="px-3 py-2.5 font-medium">Updated</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ row, summary }) => {
                  const overPct =
                    summary.overProbability == null
                      ? null
                      : summary.overProbability <= 1
                        ? summary.overProbability * 100
                        : summary.overProbability;
                  const underPct =
                    summary.underProbability == null
                      ? null
                      : summary.underProbability <= 1
                        ? summary.underProbability * 100
                        : summary.underProbability;
                  return (
                    <tr key={row.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <LeagueBadge league={row.league as LeagueCode} />
                          <span className="font-medium text-white">{row.player}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-neutral-300">
                        {summary.modelSide} {row.market}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-yellow-300">
                        {summary.projectedValue.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-neutral-200">
                        {summary.marketLine}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 tabular-nums font-medium",
                          summary.modelEdge >= 0 ? "text-emerald-300" : "text-red-300",
                        )}
                      >
                        {summary.modelEdge > 0 ? "+" : ""}
                        {summary.modelEdge.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5">
                        {overPct == null || underPct == null ? (
                          <span className="text-neutral-600">—</span>
                        ) : (
                          <div className="min-w-[7rem]">
                            <div className="flex h-1.5 overflow-hidden rounded-full bg-[#1a1a1a]">
                              <div
                                className="h-full bg-emerald-500/85"
                                style={{ width: `${Math.min(100, Math.max(0, overPct))}%` }}
                              />
                              <div
                                className="h-full bg-red-500/80"
                                style={{ width: `${Math.min(100, Math.max(0, underPct))}%` }}
                              />
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] tabular-nums">
                              <span className="text-emerald-400">{overPct.toFixed(0)}%</span>
                              <span className="text-red-400">{underPct.toFixed(0)}%</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-neutral-300">
                        {summary.confidence != null ? Math.round(summary.confidence) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <ResearchScoreBadge score={summary.researchScore ?? 0} size="sm" />
                      </td>
                      <td className="px-3 py-2.5">
                        <EvPlusBadge ev={Number(summary.evPercent ?? 0)} showDash />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-300">
                        {summary.bestLine != null ? (
                          <>
                            <span className="tabular-nums">{summary.bestLine}</span>
                            {summary.bestLineBook ? (
                              <span className="ml-1 text-neutral-500">{summary.bestLineBook}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-neutral-600">Unavailable</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-neutral-400">
                        {summary.connectedCount || 0}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-neutral-500">
                        {formatUpdated(summary.linesUpdatedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={propResearchPath(row.id)}
                          className="text-xs font-medium text-yellow-400 hover:underline"
                        >
                          Report →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
