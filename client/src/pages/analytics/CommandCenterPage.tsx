import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { PropOfTheDayCard } from "@/components/command/PropOfTheDayCard";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { cn } from "@/lib/utils";

type CommandCenterResponse = {
  generatedAt: string;
  board?: { date?: string; games?: Array<any> } | null;
  gamesStartingSoon?: Array<any>;
  bestEvToday?: any | null;
  highestConfidence?: any | null;
  propOfTheDay?: any | null;
  topProps?: any[];
  injuryAlerts?: Array<{ team: string; player: string; status: string; detail?: string }>;
  savedParlays?: Array<{ id: string; title: string; legs: number }>;
  featured?: { ok: boolean; source?: any };
};

async function fetchCommandCenter(): Promise<CommandCenterResponse> {
  const res = await fetch("/api/command-center");
  if (!res.ok) throw new Error("Command Center unavailable");
  return res.json();
}

export default function CommandCenterPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["command-center"],
    queryFn: fetchCommandCenter,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Command Center"
        title="Edge today"
        description="Best EV, confidence, injuries, and the featured prop — without the noise."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-lg border border-[#1a1a1a] bg-[#111] px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-60"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={4} />
          <CardSkeleton rows={5} />
          <CardSkeleton rows={5} />
        </div>
      )}

      {isError && (
        <EmptyState
          title="Couldn’t load live Command Center"
          description="The NBA ESPN adapter may be unreachable. Retry, or open the NBA board with mock research."
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="rounded-full border border-[#1a1a1a] bg-[#111] px-3 py-1.5">
              ESPN slate · {data.board?.date || "today"}
            </span>
            <span className="rounded-full border border-[#1a1a1a] bg-[#111] px-3 py-1.5">
              {(data.board?.games ?? data.gamesStartingSoon ?? []).length} games
            </span>
            <span className="rounded-full border border-[#1a1a1a] bg-[#111] px-3 py-1.5">
              Updated {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
            {data.featured?.source?.odds === "model-placeholder-110" && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200">
                Odds: model placeholder (−110) until ODDS_API_KEY
              </span>
            )}
          </div>

          {data.propOfTheDay ? (
            <PropOfTheDayCard prop={data.propOfTheDay} />
          ) : (
            <EmptyState
              title="No Prop of the Day yet"
              description="Once ESPN returns a usable NBA game + gamelog, the analytics engine will publish a featured prop here."
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Best EV today"
              value={data.bestEvToday ? `+${Number(data.bestEvToday.evPercent ?? 0).toFixed(1)}%` : "—"}
              sub={data.bestEvToday ? `${data.bestEvToday.player} · ${data.bestEvToday.market}` : "Waiting on slate"}
              accent="emerald"
            />
            <MetricCard
              label="Highest confidence"
              value={data.highestConfidence ? `${data.highestConfidence.confidence}` : "—"}
              sub={
                data.highestConfidence
                  ? `${data.highestConfidence.player} · ${data.highestConfidence.market}`
                  : "Waiting on slate"
              }
              accent="gold"
            />
            <MetricCard
              label="Injury alerts"
              value={`${(data.injuryAlerts ?? []).length}`}
              sub="From ESPN game summaries"
            />
            <MetricCard
              label="Saved parlays"
              value={`${(data.savedParlays ?? []).length}`}
              sub="Sign-in + DB coming next"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5 xl:col-span-2 transition hover:border-yellow-500/20">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Top props</h2>
                <Link href="/nba" className="text-xs text-yellow-400 hover:underline">
                  NBA board
                </Link>
              </div>
              {(data.topProps ?? []).length === 0 ? (
                <EmptyState title="No props computed" description="Gamelog + line derivation needed." className="py-10" />
              ) : (
                <ul className="divide-y divide-[#151515]">
                  {(data.topProps ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <LeagueBadge league="NBA" />
                          <p className="font-medium text-neutral-100">{p.player}</p>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          {p.market} {p.side} {p.line} · EV +{Number(p.evPercent ?? 0).toFixed(1)}% · Conf {p.confidence}
                        </p>
                      </div>
                      <ResearchScoreBadge score={p.researchScore} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-6">
              <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5 transition hover:border-yellow-500/20">
                <h2 className="text-base font-semibold text-white">Games starting soon</h2>
                <ul className="mt-4 space-y-2">
                  {(data.gamesStartingSoon ?? []).length === 0 && (
                    <p className="text-sm text-neutral-500">No games on the current ESPN day.</p>
                  )}
                  {(data.gamesStartingSoon ?? []).map((g) => (
                    <li
                      key={g.id}
                      className="rounded-xl border border-[#1a1a1a] bg-black/25 px-3 py-3 transition hover:border-neutral-700"
                    >
                      <p className="text-sm font-medium text-neutral-100">{g.shortName}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {g.statusDetail || g.status} · {new Date(g.tipoffAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5 transition hover:border-yellow-500/20">
                <h2 className="text-base font-semibold text-white">Injury alerts</h2>
                <ul className="mt-4 space-y-2">
                  {(data.injuryAlerts ?? []).length === 0 && (
                    <p className="text-sm text-neutral-500">No injury tags on the featured game.</p>
                  )}
                  {(data.injuryAlerts ?? []).map((a, i) => (
                    <li key={`${a.player}-${i}`} className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3">
                      <p className="text-sm text-neutral-100">
                        {a.player} · {a.team}
                      </p>
                      <p className="mt-1 text-xs text-amber-200/90">
                        {a.status}
                        {a.detail ? ` · ${a.detail}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "emerald" | "gold";
}) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-3 transition hover:border-neutral-700">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          accent === "emerald" && "text-emerald-300",
          accent === "gold" && "text-yellow-400",
          !accent && "text-white",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}
