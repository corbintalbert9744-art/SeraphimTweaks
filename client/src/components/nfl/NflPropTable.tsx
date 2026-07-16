import { Plus, Check } from "lucide-react";
import { Link } from "wouter";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { LeanBadge } from "@/components/shared/LeanBadge";
import { type NflProp } from "@/data/nflMock";
import { nflToBuilderLeg } from "@/lib/builderMappers";
import { leanTextClass } from "@/lib/leanTheme";
import { playerProfilePath, propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";

function edgePercentDisplay(row: NflProp): number | null {
  if (row.edgePercent != null && Number.isFinite(row.edgePercent)) return row.edgePercent;
  const proj = row.projectedValue;
  if (proj == null || !row.line) return null;
  return ((proj - row.line) / row.line) * 100;
}

export function NflPropTable({
  rows,
  platformLabel,
}: {
  rows: NflProp[];
  platformLabel?: string | null;
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-5">
        <div>
          <h2 className="text-base font-semibold text-white">
            NFL{platformLabel ? ` · ${platformLabel}` : ""} Prop Board
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Player · stat · line · projection · edge % · confidence
          </p>
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
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3.5 font-medium">Player</th>
              <th className="px-4 py-3.5 font-medium">Stat</th>
              <th className="px-4 py-3.5 font-medium">Line</th>
              <th className="px-4 py-3.5 font-medium">Projection</th>
              <th className="px-4 py-3.5 font-medium">Edge %</th>
              <th className="px-4 py-3.5 font-medium">Confidence</th>
              <th className="px-4 py-3.5 font-medium text-right">Builder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row) => {
              const added = hasLeg(row.id);
              const edgePct = edgePercentDisplay(row);
              const proj = row.projectedValue ?? row.line;
              return (
                <tr key={row.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <Link
                      href={playerProfilePath(row.playerId)}
                      className="font-medium text-neutral-100 hover:text-yellow-400"
                    >
                      {row.player}
                    </Link>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {row.team} vs {row.opponent} · {row.position}
                      {row.week ? ` · W${row.week}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={propResearchPath(row.id)} className="text-neutral-300 hover:text-yellow-400">
                      {row.market}
                    </Link>
                    <div className="mt-1.5">
                      {row.market === "Anytime TD" ? (
                        <LeanBadge side={row.side} showLine={false} size="sm" />
                      ) : (
                        <LeanBadge side={row.side} line={row.line} size="sm" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 tabular-nums text-neutral-200">{row.line.toFixed(1)}</td>
                  <td className={cn("px-4 py-4 tabular-nums font-semibold", leanTextClass(row.side))}>
                    {proj.toFixed(1)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                        (edgePct ?? 0) >= 0
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-red-500/10 text-red-300",
                      )}
                    >
                      {edgePct == null
                        ? "—"
                        : `${edgePct > 0 ? "+" : ""}${edgePct.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <ConfidenceBadge score={row.confidence} size="sm" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addLeg(nflToBuilderLeg(row))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                        added
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-white/[0.08] text-neutral-300 hover:border-yellow-500/40 hover:text-yellow-400",
                      )}
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {added ? "Added" : "Add"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
