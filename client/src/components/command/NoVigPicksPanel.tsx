import { Link } from "wouter";
import { EmptyState } from "@/components/shared/EmptyState";
import { propResearchPath } from "@/lib/playerLinks";
import { leanNoVigPct, noVigEdgePct, type NoVigPick } from "@/lib/novigAlerts";
import { HitPctChip } from "@/components/research/DeskPrimitives";
import { cn } from "@/lib/utils";

function sportDot(league?: string): string {
  const l = (league || "").toUpperCase();
  if (l.includes("WNBA")) return "bg-pink-400";
  if (l.includes("MLB")) return "bg-sky-400";
  if (l.includes("NFL")) return "bg-amber-500";
  if (l.includes("NHL")) return "bg-cyan-400";
  if (l.includes("SOCCER") || l.includes("MLS")) return "bg-lime-400";
  if (l.includes("TENNIS") || l.includes("ATP") || l.includes("WTA")) return "bg-yellow-400";
  return "bg-yellow-500";
}

/** OddsIQ-style matched market bar: lean % vs opposite (Seraphim gold accents). */
function MatchedMarketBar({ leanPct, side }: { leanPct: number; side: string }) {
  const lean = Math.min(100, Math.max(0, leanPct));
  const opp = Math.round((100 - lean) * 10) / 10;
  const leanRounded = Math.round(lean * 10) / 10;
  const leanIsOver = String(side).toLowerCase() !== "under";
  const leftPct = leanIsOver ? leanRounded : opp;
  const rightPct = leanIsOver ? opp : leanRounded;
  return (
    <div className="min-w-[10rem]">
      <div className="flex h-2 overflow-hidden rounded-full bg-[#1a1a1a]">
        <div
          className="h-full bg-emerald-500/80"
          style={{ width: `${leftPct}%` }}
          title={`Over ${leftPct}%`}
        />
        <div
          className="h-full bg-red-500/75"
          style={{ width: `${rightPct}%` }}
          title={`Under ${rightPct}%`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums">
        <span className="text-emerald-400">{leftPct}%</span>
        <span className="text-red-400">{rightPct}%</span>
      </div>
      <p className="mt-0.5 text-[10px] text-neutral-500">
        No-vig · {String(side).toUpperCase()} lean
      </p>
    </div>
  );
}

/**
 * Minimal No-Vig board (OddsIQ-like dense table, Seraphim gold chrome).
 */
export function NoVigPicksPanel({
  picks,
  refreshedAt,
}: {
  picks: NoVigPick[];
  refreshedAt?: string | null;
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-[var(--seraphim-border)] bg-[var(--seraphim-surface)]"
      data-feature="novig-picks"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--seraphim-border)] px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <h2 className="text-base font-semibold text-white">No-Vig Board</h2>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Juice-free lean edges on today’s slate — strongest first
            {refreshedAt
              ? ` · updated ${new Date(refreshedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
        <Link
          href="/alerts"
          className="shrink-0 rounded-md border border-[#1a1a1a] bg-[#111] px-2.5 py-1.5 text-[11px] font-medium text-yellow-400 hover:border-yellow-500/30"
        >
          Alerts
        </Link>
      </div>

      {picks.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No strong no-vig edges yet"
            description="When lean-side no-vig clears ~54%+, great picks land here."
            className="py-8"
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-[13px]">
            <thead className="bg-[#0e0e0e] text-[10px] uppercase tracking-[0.08em] text-neutral-500">
              <tr className="border-b border-[var(--seraphim-border)]">
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Sport</th>
                <th className="px-3 py-2 font-medium">Prop</th>
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium">Matched market</th>
                <th className="px-3 py-2 font-medium">Edge</th>
                <th className="px-2 py-2 text-center font-medium">Lean</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {picks.slice(0, 12).map((p) => {
                const nv = leanNoVigPct(p);
                const edge = noVigEdgePct(p);
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[#141414] transition hover:bg-yellow-500/[0.03]"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-neutral-100">{p.player}</p>
                      <p className="mt-0.5 text-[10px] text-neutral-500">
                        {[p.team, p.opponent ? `vs ${p.opponent}` : null].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-300">
                        <span className={cn("h-1.5 w-1.5 rounded-full", sportDot(p.league))} />
                        {p.league || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-200">{p.market}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold tabular-nums text-white">{p.line}</p>
                      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{p.side}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <MatchedMarketBar leanPct={nv} side={p.side} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          edge >= 8
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-yellow-500/10 text-yellow-300",
                        )}
                      >
                        +{edge.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <HitPctChip value={nv} compact />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={propResearchPath(p.id)}
                        className="text-[11px] font-medium text-yellow-400 hover:underline"
                      >
                        Report
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
