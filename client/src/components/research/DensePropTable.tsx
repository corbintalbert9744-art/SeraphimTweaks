import { Plus, Check } from "lucide-react";
import { Link } from "wouter";
import { playerProfilePath, propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import { modelEdgePercent } from "@/lib/playerResearchProfile";
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
  tipTime?: string | null;
  l5?: string;
  l10?: string;
  l20?: string;
  season?: string;
};

/** Prefer true pricing EV% for the +EV badge; fall back to coherent model edge %. */
function evForBadge(row: DensePropRow): number | null {
  if (row.evPercent != null && Number.isFinite(row.evPercent)) return row.evPercent;
  if (row.edgePercent != null && Number.isFinite(row.edgePercent)) return row.edgePercent;
  const proj = row.projectedValue;
  if (proj == null || !row.line) return null;
  const lean = row.side === "Under" ? "Under" : "Over";
  const leanP = row.noVigProb ?? 0.55;
  const overP = lean === "Over" ? leanP : 1 - leanP;
  return modelEdgePercent({
    projected: proj,
    line: row.line,
    overProbability: overP,
    underProbability: 1 - overP,
    side: lean,
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/** Rough streak from L5 hit string (e.g. 4/5 → +4 lean). */
function streakFromL5(l5?: string): { label: string; positive: boolean } | null {
  const parsed = parseHitRate(l5);
  if (!parsed.samples) return null;
  const misses = parsed.samples - parsed.hits;
  if (parsed.hits >= misses) {
    return { label: `+${parsed.hits}`, positive: true };
  }
  return { label: `-${misses}`, positive: false };
}

/**
 * Minimal dense prop desk (OddsIQ-style columns, Seraphim gold accents).
 * Player · Matchup · Line · EV+ · L5/L10/L20/Szn · Streak · Time · Add
 */
export function DensePropTable({
  rows,
  title = "Props",
  subtitle,
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
      className="overflow-hidden rounded-lg border border-[var(--seraphim-border)] bg-[var(--seraphim-surface)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--seraphim-border)] px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
            <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
          </div>
          {(platformLabel || subtitle) && (
            <p className="mt-0.5 truncate text-[11px] text-neutral-500">
              {[platformLabel, subtitle].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <p className="shrink-0 text-[11px] tabular-nums text-neutral-500">{rows.length} props</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#0c0c0c] text-[10px] uppercase tracking-[0.08em] text-neutral-500">
            <tr className="border-b border-[var(--seraphim-border)]">
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Matchup</th>
              <th className="px-3 py-2 font-medium">Line · Books</th>
              <th className="px-3 py-2 font-medium">EV+</th>
              <th className="px-2 py-2 text-center font-medium">L5</th>
              <th className="px-2 py-2 text-center font-medium">L10</th>
              <th className="px-2 py-2 text-center font-medium">L20</th>
              <th className="px-2 py-2 text-center font-medium">Szn</th>
              <th className="px-2 py-2 text-center font-medium">Streak</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const added = hasLeg(row.id);
              const edgePct = evForBadge(row);
              const proj = row.projectedValue;
              const vsAvg = proj != null ? Number((proj - row.line).toFixed(1)) : null;
              const streak = streakFromL5(row.l5);
              return (
                <tr
                  key={row.id}
                  className="border-b border-[#141414] transition hover:bg-yellow-500/[0.03]"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#141414] text-[10px] font-semibold text-yellow-400">
                        {initials(row.player)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={playerProfilePath(row.playerId)}
                          className="block truncate font-medium text-neutral-100 hover:text-yellow-400"
                        >
                          {row.player}
                        </Link>
                        <p className="truncate text-[10px] uppercase tracking-wide text-neutral-500">
                          {[row.position, row.team].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={propResearchPath(row.id)}
                      className="font-medium text-neutral-200 hover:text-yellow-400"
                    >
                      {row.market}
                      <span className="text-neutral-500">
                        {" "}
                        {row.side === "Under" ? "@" : "vs"} {row.opponent}
                      </span>
                    </Link>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                      {row.team} · {row.side}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[15px] font-semibold tabular-nums text-white">
                        {Number.isInteger(row.line) ? row.line.toFixed(0) : row.line.toFixed(1)}
                      </p>
                      {platformLabel ? (
                        <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-yellow-400/90">
                          {platformLabel.slice(0, 2)}
                        </span>
                      ) : null}
                    </div>
                    {vsAvg != null ? (
                      <p
                        className={cn(
                          "text-[10px] tabular-nums",
                          vsAvg >= 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {vsAvg > 0 ? "+" : ""}
                        {vsAvg} avg
                      </p>
                    ) : (
                      <p className="text-[10px] text-neutral-600">{row.side}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <EvPlusBadge ev={edgePct ?? 0} compact showDash={false} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <HitPctChip value={row.l5} compact />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <HitPctChip value={row.l10} compact />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <HitPctChip value={row.l20} compact />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <HitPctChip value={row.season} compact />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {streak ? (
                      <span
                        className={cn(
                          "inline-flex min-w-[2rem] items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          streak.positive
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300",
                        )}
                      >
                        {streak.label}
                      </span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <p className="whitespace-nowrap text-[11px] tabular-nums text-neutral-400">
                      {row.tipTime || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onAdd(row)}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-md border transition",
                        added
                          ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                          : "border-[#222] bg-transparent text-neutral-500 hover:border-yellow-500/35 hover:text-yellow-400",
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
