import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import type { PropRow } from "@/data/mock";
import { cn } from "@/lib/utils";

export function TopPropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <section className="card-3d overflow-hidden rounded-2xl border border-[#1a1a1a]">
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">Top Props Today</h2>
          <p className="text-xs text-neutral-500">Ranked by research case quality + edge (live)</p>
        </div>
        <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-medium text-yellow-400">
          {rows.length} shown
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Player</th>
              <th className="px-5 py-3 font-medium">Market</th>
              <th className="px-5 py-3 font-medium">Odds</th>
              <th className="px-5 py-3 font-medium">EV</th>
              <th className="px-5 py-3 font-medium">Research</th>
              <th className="px-5 py-3 font-medium">L10</th>
              <th className="px-5 py-3 font-medium">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151515]">
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-yellow-500/[0.03]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-neutral-100">{row.player}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <LeagueBadge league={row.league} />
                        <span className="text-xs text-neutral-500">{row.team}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-neutral-300">
                  <span className="text-neutral-100">{row.market}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{row.line}</span>
                </td>
                <td className="px-5 py-3.5 tabular-nums text-neutral-200">{row.odds}</td>
                <td className="px-5 py-3.5">
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
                    +{row.evPercent.toFixed(1)}%
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <ResearchScoreBadge score={row.researchScore} size="sm" />
                </td>
                <td className="px-5 py-3.5 tabular-nums text-neutral-300">{row.l10}</td>
                <td className="px-5 py-3.5 max-w-[220px]">
                  <p className="truncate text-xs text-neutral-400" title={row.why}>
                    {row.why}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.checks.slice(0, 3).map((check) => (
                      <span
                        key={check.code}
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[10px]",
                          check.status === "pass" && "border-emerald-500/20 text-emerald-300/90",
                          check.status === "warn" && "border-amber-500/20 text-amber-300/90",
                          check.status === "fail" && "border-red-500/20 text-red-300/90",
                          check.status === "unknown" && "border-neutral-600 text-neutral-500",
                        )}
                      >
                        {check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "~"} {check.label}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
