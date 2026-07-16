import { Link } from "wouter";
import { Plus, Check } from "lucide-react";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import type { NflPlayerCard, NflProp } from "@/data/nflMock";
import { nflToBuilderLeg } from "@/lib/builderMappers";
import { cn } from "@/lib/utils";

export function NflPlayerCards({
  players,
  props = [],
}: {
  players: NflPlayerCard[];
  props?: NflProp[];
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Featured Players</h2>
          <p className="text-xs text-neutral-500">Live cards with usage + matchup context</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => {
          const topProp =
            props.find((p) => p.id === player.topPropId) ??
            props.find((p) => p.playerId === player.id);
          const added = topProp ? hasLeg(topProp.id) : false;

          return (
            <article
              key={player.id}
              className="card-3d flex flex-col rounded-2xl border border-[#1a1a1a] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300">
                  {player.headshotInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="truncate font-semibold text-white">
                        <Link href={`/player/${player.id}`} className="hover:text-yellow-400">
                          {player.name}
                        </Link>
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {player.team} vs {player.opponent} · {player.position}
                      </p>
                    </div>
                    <ResearchScoreBadge score={player.confidence} size="sm" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#1a1a1a] bg-black/25 p-3">
                {player.seasonAvg.passYds != null && (
                  <Avg label="PASS" value={player.seasonAvg.passYds} />
                )}
                {player.seasonAvg.rushYds != null && (
                  <Avg label="RUSH" value={player.seasonAvg.rushYds} />
                )}
                {player.seasonAvg.recYds != null && (
                  <Avg label="REC YD" value={player.seasonAvg.recYds} />
                )}
                {player.seasonAvg.receptions != null && (
                  <Avg label="REC" value={player.seasonAvg.receptions} />
                )}
              </div>

              <p className="mt-3 text-xs leading-relaxed text-neutral-400">{player.matchupNote}</p>
              <p className="mt-2 text-[11px] text-neutral-500">
                Proj. snap % ·{" "}
                <span className="text-neutral-300">{player.projectedSnapPct}%</span>
              </p>

              {topProp && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#151515] pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-neutral-500">Top lean</p>
                    <p className="truncate text-sm text-neutral-200">
                      {topProp.market} {topProp.side} {topProp.line}{" "}
                      <span className="text-emerald-300">+{topProp.evPercent.toFixed(1)}%</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addLeg(nflToBuilderLeg(topProp))}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      added
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
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

      <p className="mt-3 text-center text-[11px] text-neutral-600">
        Cross-league builder supported.{" "}
        <Link href="/parlay-builder" className="text-yellow-500/80 hover:text-yellow-400">
          Open Parlay Builder
        </Link>
      </p>
    </section>
  );
}

function Avg({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-100">{value.toFixed(1)}</p>
    </div>
  );
}
