import { Plus, Check } from "lucide-react";
import { Link } from "wouter";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { LeanBadge } from "@/components/shared/LeanBadge";
import { leanTextClass } from "@/lib/leanTheme";
import { playerProfilePath, propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import { HitRateMatrixCell } from "./HitRateChips";
import { parseHitRate } from "./hitRate";

export type DensePropRow = {
  id: string;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  position?: string;
  market: string;
  side: "Over" | "Under" | string;
  line: number;
  projectedValue?: number | null;
  edgePercent?: number | null;
  edgeVsLine?: number | null;
  confidence: number;
  researchScore?: number;
  noVigProb?: number;
  evPercent?: number;
  l5?: string;
  l10?: string;
  l20?: string;
  season?: string;
};

function edgeOf(row: DensePropRow): number | null {
  if (row.edgePercent != null && Number.isFinite(row.edgePercent)) return row.edgePercent;
  const proj = row.projectedValue;
  if (proj == null || !row.line) return null;
  return ((proj - row.line) / row.line) * 100;
}

/**
 * High-density prop board table — line, projection, edge, L5–Season hit matrix, builder.
 */
export function DensePropTable({
  rows,
  title = "Prop board",
  subtitle = "Projection · edge · hit rates · confidence",
  platformLabel,
  onAdd,
  hasLeg,
}: {
  rows: DensePropRow[];
  title?: string;
  subtitle?: string;
  platformLabel?: string | null;
  onAdd: (row: DensePropRow) => void;
  hasLeg: (id: string) => boolean;
}) {
  return (
    <section
      data-feature="dense-prop-table"
      className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]"
    >
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-white sm:text-base">{title}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {platformLabel ? `${platformLabel} · ${subtitle}` : subtitle}
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
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Player</th>
              <th className="px-3 py-2.5 font-medium">Market</th>
              <th className="px-3 py-2.5 font-medium">Line</th>
              <th className="px-3 py-2.5 font-medium">Proj</th>
              <th className="px-3 py-2.5 font-medium">Edge</th>
              <th className="px-3 py-2.5 font-medium text-right">L5</th>
              <th className="px-3 py-2.5 font-medium text-right">L10</th>
              <th className="px-3 py-2.5 font-medium text-right">L20</th>
              <th className="px-3 py-2.5 font-medium text-right">Season</th>
              <th className="px-3 py-2.5 font-medium">Conf</th>
              <th className="px-3 py-2.5 font-medium text-right">Add</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((row) => {
              const added = hasLeg(row.id);
              const edgePct = edgeOf(row);
              const proj = row.projectedValue;
              const l10 = parseHitRate(row.l10);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "transition hover:bg-white/[0.025]",
                    l10.pct >= 70 && "bg-emerald-500/[0.03]",
                  )}
                >
                  <td className="px-3 py-3">
                    <Link
                      href={playerProfilePath(row.playerId)}
                      className="font-medium text-neutral-100 hover:text-yellow-400"
                    >
                      {row.player}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {row.team} vs {row.opponent}
                      {row.position ? ` · ${row.position}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Link href={propResearchPath(row.id)} className="text-neutral-300 hover:text-yellow-400">
                      {row.market}
                    </Link>
                    <div className="mt-1">
                      <LeanBadge side={row.side === "Under" ? "Under" : "Over"} line={row.line} size="sm" />
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-neutral-200">{row.line.toFixed(1)}</td>
                  <td className={cn("px-3 py-3 tabular-nums font-semibold", leanTextClass(row.side === "Under" ? "Under" : "Over"))}>
                    {proj == null ? "—" : proj.toFixed(1)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                        (edgePct ?? 0) >= 0
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-red-500/10 text-red-300",
                      )}
                    >
                      {edgePct == null ? "—" : `${edgePct > 0 ? "+" : ""}${edgePct.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <HitRateMatrixCell value={row.l5} />
                  </td>
                  <td className="px-3 py-3">
                    <HitRateMatrixCell value={row.l10} />
                  </td>
                  <td className="px-3 py-3">
                    <HitRateMatrixCell value={row.l20} />
                  </td>
                  <td className="px-3 py-3">
                    <HitRateMatrixCell value={row.season} />
                  </td>
                  <td className="px-3 py-3">
                    <ConfidenceBadge score={row.confidence} size="sm" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onAdd(row)}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                        added
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-[#1a1a1a] bg-[#111] text-neutral-400 hover:border-yellow-500/30 hover:text-yellow-400",
                      )}
                      aria-label={added ? "In builder" : "Add to builder"}
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
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
