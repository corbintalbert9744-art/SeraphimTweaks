import { Link } from "wouter";
import { Plus, Check } from "lucide-react";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { LeanBadge } from "@/components/shared/LeanBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import type { NbaPlayerCard, NbaProp } from "@/data/nbaMock";
import { nbaToBuilderLeg } from "@/lib/builderMappers";
import { leanTextClass } from "@/lib/leanTheme";
import { cn } from "@/lib/utils";

export function NbaPlayerCards({
  players,
  props = [],
}: {
  players: NbaPlayerCard[];
  props?: NbaProp[];
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Players</h2>
          <p className="text-xs text-neutral-500">
            Model projections · Research Score · top lean — click a player for the full report
          </p>
        </div>
        <p className="text-xs tabular-nums text-neutral-500">{players.length} on board</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => {
          const topProp =
            props.find((p) => p.id === player.topPropId) ??
            props.find((p) => p.playerId === player.id && p.market === "Points") ??
            props.find((p) => p.playerId === player.id);
          const added = topProp ? hasLeg(topProp.id) : false;
          const proj = player.projections ?? player.seasonAvg;
          const rs = player.researchScore ?? player.confidence;
          const topLeanLabel =
            player.topLean ||
            (topProp ? `${topProp.market} ${topProp.side} ${topProp.line}` : null);
          const insight = player.insight || player.matchupNote;

          return (
            <article
              key={player.id}
              className="card-3d flex flex-col rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/80 p-5 transition hover:border-yellow-500/25"
            >
              <div className="flex items-start gap-3">
                <Link
                  href={`/player/${player.id}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-500/35 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300 transition hover:scale-105"
                >
                  {player.headshotInitials}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        <Link href={`/player/${player.id}`} className="hover:text-yellow-400">
                          {player.name}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {player.team} vs {player.opponent} · {player.position}
                      </p>
                    </div>
                    <ResearchScoreBadge score={rs} size="sm" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#1a1a1a] bg-black/30 p-3">
                <Avg label="PTS" value={proj.pts} side={topProp?.side} />
                <Avg label="REB" value={proj.reb} side={topProp?.side} />
                <Avg label="AST" value={proj.ast} side={topProp?.side} />
              </div>

              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-neutral-400">{insight}</p>

              {topLeanLabel && topProp && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#151515] pt-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">{topProp.market}</p>
                    <div className="mt-1">
                      <LeanBadge side={topProp.side} line={topProp.line} size="sm" />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addLeg(nbaToBuilderLeg(topProp))}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      added
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-yellow-500/35 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
                    )}
                  >
                    {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {added ? "Added" : "Add"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Avg({
  label,
  value,
  side,
}: {
  label: string;
  value: number;
  side?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", leanTextClass(side ?? "Over"))}>
        {value.toFixed(1)}
      </p>
    </div>
  );
}
