import { Link } from "wouter";
import { Plus, Check } from "lucide-react";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { LeanBadge } from "@/components/shared/LeanBadge";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import type { NbaPlayerCard, NbaProp } from "@/data/nbaMock";
import { nbaToBuilderLeg } from "@/lib/builderMappers";
import { leanTextClass } from "@/lib/leanTheme";
import { cn } from "@/lib/utils";

function edgePercentOf(prop: NbaProp | undefined): number | null {
  if (!prop) return null;
  if (prop.edgePercent != null && Number.isFinite(prop.edgePercent)) return prop.edgePercent;
  if (prop.projectedValue == null || !prop.line) return null;
  return ((prop.projectedValue - prop.line) / prop.line) * 100;
}

/** Player cards for research boards — show platform line + model projection (not basketball PTS/REB/AST). */
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
            Platform line · our projection · edge % · confidence — click a player for the full report
          </p>
        </div>
        <p className="text-xs tabular-nums text-neutral-500">{players.length} on board</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => {
          const playerProps = props.filter((p) => p.playerId === player.id);
          // Prefer prop with a model projection; else first match / topPropId
          const withModel = playerProps
            .filter((p) => p.projectedValue != null)
            .sort(
              (a, b) =>
                Math.abs(b.edgePercent ?? b.edgeVsLine ?? 0) -
                Math.abs(a.edgePercent ?? a.edgeVsLine ?? 0),
            );
          const topProp =
            withModel[0] ??
            props.find((p) => p.id === player.topPropId) ??
            playerProps[0] ??
            props.find((p) => p.playerId === player.id);
          const added = topProp ? hasLeg(topProp.id) : false;
          const rs = player.researchScore ?? topProp?.researchScore ?? player.confidence;
          const confidence = topProp?.confidence ?? player.confidence ?? 0;
          const edgePct = edgePercentOf(topProp);
          const insight = player.insight || player.matchupNote;
          const projected = topProp?.projectedValue;

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
                        {player.team} vs {player.opponent}
                        {player.position ? ` · ${player.position}` : ""}
                        {player.tipTime
                          ? ` · ${(() => {
                              const t = Date.parse(player.tipTime);
                              return Number.isFinite(t)
                                ? new Date(t).toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : player.tipTime;
                            })()}`
                          : ""}
                      </p>
                    </div>
                    <ResearchScoreBadge score={rs} size="sm" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#1a1a1a] bg-black/30 p-3">
                <Metric
                  label="Line"
                  value={topProp?.line}
                  side={topProp?.side}
                />
                <Metric
                  label="Projection"
                  value={projected}
                  side={topProp?.side}
                  emphasize
                />
                <Metric
                  label="Edge %"
                  value={edgePct}
                  side={topProp?.side}
                  suffix="%"
                  signed
                />
              </div>

              {topProp && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-neutral-400">
                    <span className="font-medium text-neutral-300">{topProp.market}</span>
                    {insight ? ` · ${insight}` : ""}
                  </p>
                  <ConfidenceBadge score={confidence} size="sm" />
                </div>
              )}

              {topProp && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#151515] pt-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {topProp.market}
                    </p>
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

function Metric({
  label,
  value,
  side,
  suffix = "",
  signed = false,
  emphasize = false,
}: {
  label: string;
  value?: number | null;
  side?: string;
  suffix?: string;
  signed?: boolean;
  emphasize?: boolean;
}) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : null;
  const text =
    n == null
      ? "—"
      : `${signed && n > 0 ? "+" : ""}${n.toFixed(1)}${suffix}`;
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          emphasize ? leanTextClass(side ?? "Over") : "text-neutral-200",
          n != null && signed && (n >= 0 ? "text-emerald-400" : "text-red-400"),
        )}
      >
        {text}
      </p>
    </div>
  );
}
