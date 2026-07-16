import { Link } from "wouter";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { propResearchPath } from "@/lib/playerLinks";
import { leanNoVigPct, noVigEdgePct, type NoVigPick } from "@/lib/novigAlerts";
import type { LeagueCode } from "@/data/mock";
import { cn } from "@/lib/utils";

export function NoVigPicksPanel({
  picks,
  refreshedAt,
}: {
  picks: NoVigPick[];
  refreshedAt?: string | null;
}) {
  return (
    <section
      className="card-3d rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-5 transition hover:border-emerald-500/35"
      data-feature="novig-picks"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
            No-vig · refreshes every 5 min
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">Great no-vig picks</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Juice-free lean edges on today’s slate — strongest first
            {refreshedAt
              ? ` · updated ${new Date(refreshedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
        <Link href="/alerts" className="text-xs text-yellow-400 hover:underline">
          Alerts
        </Link>
      </div>

      {picks.length === 0 ? (
        <EmptyState
          title="No strong no-vig edges yet"
          description="When lean-side no-vig clears ~54%+, great picks land here."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-[#151515]">
          {picks.slice(0, 8).map((p, idx) => {
            const nv = leanNoVigPct(p);
            const edge = noVigEdgePct(p);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:bg-white/[0.02]"
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
                        edge >= 8 ? "text-emerald-300" : "text-white",
                      )}
                    >
                      {nv}%
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                      No-vig · +{edge.toFixed(1)}%
                    </p>
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
    </section>
  );
}
