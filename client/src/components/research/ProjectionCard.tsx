import { Link } from "wouter";
import { Plus, Check } from "lucide-react";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { LeanBadge } from "@/components/shared/LeanBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { leanTextClass } from "@/lib/leanTheme";
import { propResearchPath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";
import type { LeagueCode } from "@/data/mock";
import { HitRateChips } from "./HitRateChips";
import { modelEdgePercent } from "@/lib/playerResearchProfile";

export type ProjectionCardProp = {
  id: string;
  player: string;
  team?: string;
  opponent?: string;
  market: string;
  side: "Over" | "Under" | string;
  line: number;
  league?: string;
  projectedValue?: number | null;
  edgePercent?: number | null;
  edgeVsLine?: number | null;
  noVigProb?: number | null;
  evPercent?: number | null;
  confidence?: number | null;
  researchScore?: number | null;
  l5?: string;
  l10?: string;
  l20?: string;
  season?: string;
};

/**
 * Compact Seraphim projection tile — proj vs line, edge, lean, hit chips.
 * Designed for Command Center, boards, and research hubs (not a marketing card).
 */
export function ProjectionCard({
  prop,
  onAdd,
  added,
  featured,
  className,
}: {
  prop: ProjectionCardProp;
  onAdd?: () => void;
  added?: boolean;
  featured?: boolean;
  className?: string;
}) {
  const proj = prop.projectedValue;
  const leanSide = prop.side === "Under" ? "Under" : "Over";
  const leanProb =
    prop.noVigProb != null
      ? Number(prop.noVigProb)
      : leanSide === "Over"
        ? 0.55
        : 0.45;
  const overP = leanSide === "Over" ? leanProb : 1 - leanProb;
  const underP = 1 - overP;
  const edge =
    prop.edgePercent ??
    (proj != null
      ? modelEdgePercent({
          projected: proj,
          line: prop.line,
          overProbability: overP,
          underProbability: underP,
          side: leanSide,
        })
      : null);
  const noVigPct = prop.noVigProb != null ? Math.round(Number(prop.noVigProb) * 100) : null;

  return (
    <article
      data-feature="projection-card"
      className={cn(
        "rounded-xl border bg-[#0d0d0d] p-4 transition",
        featured
          ? "border-yellow-500/30 bg-gradient-to-b from-yellow-500/[0.07] to-transparent"
          : "border-[#1a1a1a] hover:border-yellow-500/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {prop.league ? <LeagueBadge league={prop.league as LeagueCode} /> : null}
            <h3 className="truncate font-semibold text-white">{prop.player}</h3>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {prop.team ? `${prop.team}` : ""}
            {prop.opponent ? ` vs ${prop.opponent}` : ""}
            {prop.team || prop.opponent ? " · " : ""}
            {prop.market}
          </p>
        </div>
        <ResearchScoreBadge score={prop.researchScore ?? prop.confidence ?? 0} size="sm" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Line" value={prop.line.toFixed(1)} />
        <Metric
          label="Projection"
          value={proj == null ? "—" : proj.toFixed(1)}
          className={leanTextClass(prop.side === "Under" ? "Under" : "Over")}
        />
        <Metric
          label="Edge"
          value={edge == null ? "—" : `${edge > 0 ? "+" : ""}${edge.toFixed(1)}%`}
          className={
            edge == null ? undefined : edge >= 0 ? "text-emerald-300" : "text-red-300"
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LeanBadge side={prop.side === "Under" ? "Under" : "Over"} line={prop.line} size="sm" />
        {noVigPct != null ? (
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-emerald-300">
            No-vig {noVigPct}%
          </span>
        ) : null}
        {prop.evPercent != null ? (
          <span className="text-[10px] tabular-nums text-neutral-500">
            EV {prop.evPercent > 0 ? "+" : ""}
            {Number(prop.evPercent).toFixed(1)}%
          </span>
        ) : null}
      </div>

      <HitRateChips
        rates={{ l5: prop.l5, l10: prop.l10, l20: prop.l20, season: prop.season }}
        size="sm"
        className="mt-3"
      />

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={propResearchPath(prop.id)}
          className="flex-1 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-center text-xs font-semibold text-yellow-400 transition hover:bg-yellow-500/15"
        >
          Full report
        </Link>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition",
              added
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-[#1a1a1a] bg-[#111] text-neutral-400 hover:border-yellow-500/30 hover:text-yellow-400",
            )}
            aria-label={added ? "In builder" : "Add to builder"}
          >
            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1a1a1a] bg-black/30 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold tabular-nums text-white", className)}>{value}</p>
    </div>
  );
}
