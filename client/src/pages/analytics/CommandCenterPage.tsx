import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { PropOfTheDayCard } from "@/components/command/PropOfTheDayCard";
import { NoVigPicksPanel } from "@/components/command/NoVigPicksPanel";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { ProjectionCard, MetricStrip, ResearchPanel } from "@/components/research";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { cn } from "@/lib/utils";
import { propResearchPath } from "@/lib/playerLinks";
import { withLegHitData } from "@/lib/legStats";
import type { LeagueCode } from "@/data/mock";
import type { BuilderLeg } from "@/data/builderTypes";
import { useToast } from "@/hooks/use-toast";
import {
  maybeDesktopNotify,
  takeNewNotifications,
  type AppNotification,
  type NoVigPick,
} from "@/lib/novigAlerts";

type CommandCenterResponse = {
  generatedAt: string;
  board?: {
    date?: string;
    games?: Array<any>;
    livePropCount?: number;
    books?: string[];
  } | null;
  gamesStartingSoon?: Array<any>;
  bestEvToday?: any | null;
  highestConfidence?: any | null;
  propOfTheDay?: any | null;
  topProps?: any[];
  bestNoVigPicks?: NoVigPick[];
  notifications?: AppNotification[];
  injuryAlerts?: Array<{ team: string; player: string; status: string; detail?: string }>;
  savedParlays?: Array<{ id: string; title: string; legs: number }>;
  featured?: { ok: boolean; source?: any };
  providers?: { novigRefreshSeconds?: number; books?: string[]; slate?: string };
};

async function fetchCommandCenter(): Promise<CommandCenterResponse> {
  const res = await fetch("/api/command-center", { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error("Command Center unavailable");
  return res.json();
}

export default function CommandCenterPage() {
  const { toast } = useToast();
  const { addLeg, hasLeg } = useParlayDraft();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["command-center"],
    queryFn: fetchCommandCenter,
    refetchInterval: 300_000,
    staleTime: 60_000,
    retry: 2,
    retryDelay: (n) => Math.min(2_000 * (n + 1), 8_000),
  });

  useEffect(() => {
    const notes = data?.notifications ?? [];
    if (!notes.length) return;
    const fresh = takeNewNotifications(notes.filter((n) => n.kind === "novig"));
    for (const n of fresh.slice(0, 2)) {
      toast({ title: n.title, description: n.detail });
      void maybeDesktopNotify(n);
    }
  }, [data?.generatedAt, data?.notifications, toast]);

  const showSkeleton = isLoading && !data;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Research desk"
        title="Command Center"
        description="Live pick'em lines from PrizePicks / Underdog / Sleeper — Seraphim projections, no-vig edges, and hit probability."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/nba"
              className="rounded-lg border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-400"
            >
              Open board
            </Link>
            <Link
              href="/parlay-builder"
              className="rounded-lg border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-400"
            >
              Builder
            </Link>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-400 disabled:opacity-60"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        }
      />

      {showSkeleton && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={4} />
        </div>
      )}

      {isError && !data && (
        <EmptyState
          title="Couldn’t load Command Center"
          description="Live betting lines are refreshing. Retry, or open a league board (WNBA / MLB) for pick'em props."
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300"
            >
              Try again
            </button>
          }
        />
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
            <span className="rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 py-1">
              Slate · {data.board?.date || "today"}
            </span>
            <span className="rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2.5 py-1 text-yellow-300">
              {Number(data.board?.livePropCount ?? data.topProps?.length ?? 0)} live props
            </span>
            {(data.board?.books ?? data.providers?.books ?? []).length > 0 ? (
              <span className="rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 py-1">
                {(data.board?.books ?? data.providers?.books ?? []).join(" · ")}
              </span>
            ) : (
              <span className="rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 py-1">
                Pick’em lines
              </span>
            )}
            <span className="rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 py-1">
              Updated {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
            <span className="rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2.5 py-1 text-yellow-300">
              No-vig every 5 min
            </span>
          </div>

          <MetricStrip
            items={[
              {
                label: "Best no-vig",
                value: data.bestNoVigPicks?.[0]
                  ? `${Math.round(Number(data.bestNoVigPicks[0].noVigPct ?? Number(data.bestNoVigPicks[0].noVigProb ?? 0) * 100))}%`
                  : "—",
                sub: data.bestNoVigPicks?.[0]
                  ? `${data.bestNoVigPicks[0].player} · +${Number(data.bestNoVigPicks[0].noVigEdgePct ?? 0).toFixed(1)}%`
                  : "Waiting on slate",
                tone: "hit",
              },
              {
                label: "Best EV",
                value: data.bestEvToday ? `+${Number(data.bestEvToday.evPercent ?? 0).toFixed(1)}%` : "—",
                sub: data.bestEvToday ? `${data.bestEvToday.player} · ${data.bestEvToday.market}` : "—",
                tone: "hit",
              },
              {
                label: "Highest confidence",
                value: data.highestConfidence ? `${data.highestConfidence.confidence}` : "—",
                sub: data.highestConfidence
                  ? `${data.highestConfidence.player} · ${data.highestConfidence.market}`
                  : "—",
                tone: "gold",
              },
              {
                label: "Alerts",
                value: `${(data.notifications ?? []).length}`,
                sub: "No-vig + injuries",
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-5">
            <div className="space-y-4 xl:col-span-3">
              {data.propOfTheDay ? (
                <PropOfTheDayCard prop={data.propOfTheDay} />
              ) : (
                <EmptyState
                  title="No Prop of the Day yet"
                  description="Waiting on live PrizePicks / Underdog / Sleeper lines for tonight’s slate."
                />
              )}

              <NoVigPicksPanel picks={data.bestNoVigPicks ?? []} refreshedAt={data.generatedAt} />

              <ResearchPanel
                title="Most likely to hit"
                subtitle="Top 6 from today’s slate by lean-side hit probability"
                action={
                  <Link href="/research" className="text-xs text-yellow-400 hover:underline">
                    Research hub
                  </Link>
                }
                bodyClassName="p-0"
              >
                {(data.topProps ?? []).length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      title="No today props yet"
                      description="Sync a pick’em board for today’s games."
                      className="py-6"
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-[#151515]">
                    {(data.topProps ?? []).slice(0, 6).map((p, idx) => {
                      const hitPct =
                        p.hitPct ??
                        Math.round(
                          Number(
                            (p.side === "Under" ? p.underProbability : p.overProbability) ??
                              p.noVigProb ??
                              0,
                          ) * 100,
                        );
                      return (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.02] sm:px-5"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] tabular-nums text-neutral-600">#{idx + 1}</span>
                              <LeagueBadge league={(p.league as LeagueCode) || "NBA"} />
                              <p className="font-medium text-neutral-100">{p.player}</p>
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">
                              {p.side} {p.line} {p.market}
                              {p.opponent ? ` · vs ${p.opponent}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  hitPct >= 60
                                    ? "text-emerald-300"
                                    : hitPct <= 45
                                      ? "text-red-300"
                                      : "text-white",
                                )}
                              >
                                {hitPct}%
                              </p>
                              <p className="text-[10px] uppercase tracking-wide text-neutral-600">Hit</p>
                            </div>
                            <ResearchScoreBadge score={p.researchScore ?? p.confidence ?? 0} size="sm" />
                            <Link
                              href={propResearchPath(p.id)}
                              className="text-xs font-medium text-yellow-400 hover:underline"
                            >
                              Report
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ResearchPanel>
            </div>

            <div className="space-y-4 xl:col-span-2">
              <ResearchPanel title="Projection cards" subtitle="Seraphim model · add to builder">
                <div className="grid gap-3">
                  {(data.topProps ?? []).slice(0, 3).map((p) => (
                    <ProjectionCard
                      key={`proj-${p.id}`}
                      prop={p}
                      onAdd={() => {
                        const leg: BuilderLeg = withLegHitData({
                          id: p.id,
                          league: (p.league as BuilderLeg["league"]) || "NBA",
                          playerId: String(p.playerId || p.id),
                          player: String(p.player ?? ""),
                          team: String(p.team ?? ""),
                          opponent: String(p.opponent ?? ""),
                          position: String(p.position ?? ""),
                          market: String(p.market ?? ""),
                          side: p.side === "Under" ? "Under" : "Over",
                          line: Number(p.line ?? 0),
                          americanOdds: Number(p.americanOdds ?? -110),
                          noVigProb: Number(p.noVigProb ?? 0.5),
                          evPercent: Number(p.evPercent ?? 0),
                          confidence: Number(p.confidence ?? 50),
                          tipTime: String(p.tipTime ?? ""),
                          eventKey: `${p.team}-${p.opponent}-${p.tipTime || p.id}`,
                          l10: String(p.l10 ?? "0/0"),
                        });
                        addLeg(leg);
                      }}
                      added={hasLeg(p.id)}
                    />
                  ))}
                  {(data.topProps ?? []).length === 0 && (
                    <EmptyState title="No projections" description="Waiting on slate." className="py-6" />
                  )}
                </div>
              </ResearchPanel>

              <ResearchPanel title="Games starting soon" bodyClassName="pt-2">
                <ul className="space-y-2">
                  {(data.gamesStartingSoon ?? []).length === 0 && (
                    <p className="text-sm text-neutral-500">No games on the current ESPN day.</p>
                  )}
                  {(data.gamesStartingSoon ?? []).map((g) => (
                    <li
                      key={g.id}
                      className="rounded-lg border border-[#1a1a1a] bg-black/25 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-neutral-100">{g.shortName}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {g.statusDetail || g.status} · {new Date(g.tipoffAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </ResearchPanel>

              <ResearchPanel title="Injury alerts" bodyClassName="pt-2">
                <ul className="space-y-2">
                  {(data.injuryAlerts ?? []).length === 0 && (
                    <p className="text-sm text-neutral-500">No injury tags on the featured game.</p>
                  )}
                  {(data.injuryAlerts ?? []).map((a, i) => (
                    <li
                      key={`${a.player}-${i}`}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5"
                    >
                      <p className="text-sm text-neutral-100">
                        {a.player} · {a.team}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-200/90">
                        {a.status}
                        {a.detail ? ` · ${a.detail}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </ResearchPanel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
