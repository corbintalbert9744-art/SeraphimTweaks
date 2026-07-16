import { Link } from "wouter";
import { Plus, Check } from "lucide-react";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { propIdToBuilderLeg } from "@/lib/addPropToBuilder";
import type { SportBoardCard } from "@/lib/playerResearchProfile";
import { leanTextClass } from "@/lib/leanTheme";
import { playerProfilePath } from "@/lib/playerLinks";
import { cn } from "@/lib/utils";

export function SportPlayerCards({
  players,
  title = "Players",
  subtitle = "Model projections · Research Score · top lean — click a player for the full report",
}: {
  players: SportBoardCard[];
  title?: string;
  subtitle?: string;
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
        <p className="text-xs tabular-nums text-neutral-500">{players.length} on board</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => {
          const added = hasLeg(player.topPropId);
          const leg = propIdToBuilderLeg(player.topPropId);
          return (
            <article
              key={player.id}
              className="card-3d flex flex-col rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/80 p-5 transition hover:border-yellow-500/25"
            >
              <div className="flex items-start gap-3">
                <Link
                  href={playerProfilePath(player.id)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-500/35 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300 transition hover:scale-105"
                >
                  {player.initials}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">
                        <Link href={playerProfilePath(player.id)} className="hover:text-yellow-400">
                          {player.name}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {player.team ? `${player.team} vs ` : "vs "}
                        {player.opponent}
                        {player.position ? ` · ${player.position}` : ""}
                      </p>
                    </div>
                    <ResearchScoreBadge score={player.researchScore} size="sm" />
                  </div>
                </div>
              </div>

              {player.projections.length > 0 && (
                <div
                  className={cn(
                    "mt-4 grid gap-2 rounded-xl border border-[#1a1a1a] bg-black/30 p-3",
                    player.projections.length === 1
                      ? "grid-cols-1"
                      : player.projections.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3",
                  )}
                >
                  {player.projections.map((p) => (
                    <div key={p.label} className="text-center">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{p.label}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-sm font-semibold tabular-nums",
                          leanTextClass(p.side ?? player.leanSide),
                        )}
                      >
                        {p.value.toFixed(1)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                {player.insight}
              </p>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#151515] pt-4">
                <p className={cn("min-w-0 truncate text-sm font-semibold", leanTextClass(player.leanSide))}>
                  {player.lean}
                </p>
                <button
                  type="button"
                  disabled={added || !leg}
                  onClick={() => leg && addLeg(leg)}
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
