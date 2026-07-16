import { Plus, Check } from "lucide-react";
import { Link } from "wouter";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { LeanBadge } from "@/components/shared/LeanBadge";
import { formatAmericanOdds, type NbaProp } from "@/data/nbaMock";
import { nbaToBuilderLeg } from "@/lib/builderMappers";
import { hitRateTextClass } from "@/lib/leanTheme";
import { cn } from "@/lib/utils";

export function NbaPropTable({
  rows,
  title = "Prop Board",
  subtitle = "Model projection · lean · edge · confidence · Research Score · EV · line comparison on open",
}: {
  rows: NbaProp[];
  title?: string;
  subtitle?: string;
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <section
      data-feature="prop-board"
      className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0d0d0d]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
        </div>
        <div className="hidden items-center gap-3 text-[11px] sm:flex">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> OVER
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-400" /> UNDER
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1280px] w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3.5 font-medium">Player</th>
              <th className="px-4 py-3.5 font-medium">Market</th>
              <th className="px-4 py-3.5 font-medium">Projection</th>
              <th className="px-4 py-3.5 font-medium">Lean</th>
              <th className="px-4 py-3.5 font-medium">Edge</th>
              <th className="px-4 py-3.5 font-medium">L10</th>
              <th className="px-4 py-3.5 font-medium">EV</th>
              <th className="px-4 py-3.5 font-medium">Conf</th>
              <th className="px-4 py-3.5 font-medium">RS</th>
              <th className="px-4 py-3.5 font-medium">Lines</th>
              <th className="px-4 py-3.5 font-medium text-right">Builder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row) => {
              const added = hasLeg(row.id);
              const edge = row.edgeVsLine;
              return (
                <tr key={row.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <Link
                      href={`/player/${row.playerId}`}
                      className="font-medium text-neutral-100 hover:text-yellow-400"
                    >
                      {row.player}
                    </Link>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {row.team} vs {row.opponent} · {row.position}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/prop/${row.id}`} className="text-neutral-300 hover:text-yellow-400">
                      {row.market}
                    </Link>
                  </td>
                  <td className="px-4 py-4 tabular-nums text-white">
                    {(row.projectedValue ?? row.line).toFixed(1)}
                  </td>
                  <td className="px-4 py-4">
                    <LeanBadge side={row.side} line={row.line} size="sm" />
                    <p className="mt-1 text-[10px] tabular-nums text-neutral-600">
                      {formatAmericanOdds(row.americanOdds)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                        (edge ?? 0) >= 0
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-red-500/10 text-red-300",
                      )}
                    >
                      {edge == null ? "—" : `${edge > 0 ? "+" : ""}${edge.toFixed(1)}`}
                    </span>
                  </td>
                  <td className={cn("px-4 py-4 tabular-nums font-medium", hitRateTextClass(row.l10))}>
                    {row.l10}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
                      +{row.evPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <ConfidenceBadge score={row.confidence} size="sm" />
                  </td>
                  <td className="px-4 py-4">
                    <ResearchScoreBadge score={row.researchScore ?? row.confidence} size="sm" />
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/prop/${row.id}`}
                      className="text-xs font-medium text-yellow-500/90 hover:text-yellow-400"
                      title="Open Line Comparison (PrizePicks, FanDuel, DraftKings, …)"
                    >
                      Compare
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addLeg(nbaToBuilderLeg(row))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                        added
                          ? "cursor-default border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
                      )}
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {added ? "Added" : "Add"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-neutral-500">
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
