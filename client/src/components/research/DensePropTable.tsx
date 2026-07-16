import { Plus, Check } from "lucide-react";
import { Link } from "wouter";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { playerProfilePath, propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import { EvPlusBadge, HitPctChip } from "./DeskPrimitives";
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
  americanOdds?: number;
  platformName?: string | null;
  l5?: string;
  l10?: string;
  l20?: string;
  season?: string;
};

function edgeOf(row: DensePropRow): number | null {
  if (row.edgePercent != null && Number.isFinite(row.edgePercent)) return row.edgePercent;
  if (row.evPercent != null && Number.isFinite(row.evPercent)) return row.evPercent;
  const proj = row.projectedValue;
  if (proj == null || !row.line) return null;
  return ((proj - row.line) / row.line) * 100;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/**
 * Dense board table styled after professional prop research desks:
 * Player · Matchup · Line · EV+ · L5/L10/L20/SZN hit chips · Add
 */
export function DensePropTable({
  rows,
  title = "Prop board",
  subtitle = "Line · EV+ · hit rates",
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
      className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0b0b0b]"
    >
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-white sm:text-base">{title}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {platformLabel ? `${platformLabel} · ${subtitle}` : subtitle}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full text-left text-sm">
          <thead className="bg-[#0f0f0f] text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Player</th>
              <th className="px-3 py-2.5 font-medium">Matchup</th>
              <th className="px-3 py-2.5 font-medium">Line</th>
              <th className="px-3 py-2.5 font-medium">EV+</th>
              <th className="px-3 py-2.5 font-medium text-center">L5</th>
              <th className="px-3 py-2.5 font-medium text-center">L10</th>
              <th className="px-3 py-2.5 font-medium text-center">L20</th>
              <th className="px-3 py-2.5 font-medium text-center">Szn</th>
              <th className="px-3 py-2.5 font-medium">Conf</th>
              <th className="px-3 py-2.5 font-medium text-right">Add</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]">
            {rows.map((row) => {
              const added = hasLeg(row.id);
              const edgePct = edgeOf(row);
              const proj = row.projectedValue;
              const vsAvg =
                proj != null ? Number((proj - row.line).toFixed(1)) : null;
              const l10 = parseHitRate(row.l10);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "transition hover:bg-white/[0.025]",
                    l10.pct >= 80 && "bg-emerald-500/[0.03]",
                  )}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#141414] text-[11px] font-semibold text-yellow-400">
                        {initials(row.player)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={playerProfilePath(row.playerId)}
                          className="font-medium text-neutral-100 hover:text-yellow-400"
                        >
                          {row.player}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {row.position || row.team}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={propResearchPath(row.id)}
                      className="font-medium text-neutral-200 hover:text-yellow-400"
                    >
                      {row.market}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      vs {row.opponent} · {row.team}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-base font-semibold tabular-nums text-white">
                      {row.line.toFixed(1)}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {row.side}
                      {vsAvg != null ? (
                        <span
                          className={cn(
                            "ml-1.5 tabular-nums",
                            vsAvg >= 0 ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {vsAvg > 0 ? "+" : ""}
                          {vsAvg} avg
                        </span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <EvPlusBadge ev={edgePct ?? 0} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <HitPctChip value={row.l5} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <HitPctChip value={row.l10} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <HitPctChip value={row.l20} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <HitPctChip value={row.season} />
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
