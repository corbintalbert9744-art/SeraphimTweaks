import { Plus, Check } from "lucide-react";
import { Link } from "wouter";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { formatAmericanOdds, type NflProp } from "@/data/nflMock";
import { nflToBuilderLeg } from "@/lib/builderMappers";
import { cn } from "@/lib/utils";

export function NflPropTable({ rows }: { rows: NflProp[] }) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <section className="card-3d overflow-hidden rounded-2xl border border-[#1a1a1a]">
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">NFL Prop Board</h2>
          <p className="text-xs text-neutral-500">
            Hit rates · No-Vig · EV · Confidence (Research Score)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Line</th>
              <th className="px-4 py-3 font-medium">Odds</th>
              <th className="px-4 py-3 font-medium">L5</th>
              <th className="px-4 py-3 font-medium">L10</th>
              <th className="px-4 py-3 font-medium">L20</th>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">No-Vig</th>
              <th className="px-4 py-3 font-medium">EV</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium text-right">Builder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151515]">
            {rows.map((row) => {
              const added = hasLeg(row.id);
              return (
                <tr key={row.id} className="transition hover:bg-yellow-500/[0.03]">
                  <td className="px-4 py-3.5">
                    <Link href={`/player/${row.playerId}`} className="font-medium text-neutral-100 hover:text-yellow-400">
                      {row.player}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {row.team} vs {row.opponent} · {row.position} · W{row.week} · {row.tipTime}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/prop/${row.id}`} className="text-neutral-300 hover:text-yellow-400">
                      {row.market}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-200">
                    {row.market === "Anytime TD" ? "Yes" : `${row.side} ${row.line}`}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-200">
                    {formatAmericanOdds(row.americanOdds)}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.l5}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.l10}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.l20}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.season}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-200">
                    {(row.noVigProb * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
                      +{row.evPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <ResearchScoreBadge score={row.confidence} size="sm" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addLeg(nflToBuilderLeg(row))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                        added
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 cursor-default"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
                      )}
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {added ? "Added" : "Add to Builder"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-sm text-neutral-500">
                  No props match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
