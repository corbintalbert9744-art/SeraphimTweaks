import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ParlayLegCard } from "@/components/parlay/ParlayLegCard";
import { L10HitMissChart } from "@/components/parlay/L10HitMissChart";
import { ProjectionCard, ResearchPanel } from "@/components/research";
import { asNbaPropFromApi, cacheNbaBoardProps } from "@/lib/nbaLiveCache";
import { cacheNflBoardProps } from "@/lib/addPropToBuilder";
import { nbaToBuilderLeg, nflToBuilderLeg } from "@/lib/builderMappers";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import type { NflProp } from "@/data/nflMock";
import type { BuilderLeg } from "@/data/builderTypes";

function asNflProp(row: Record<string, unknown>): NflProp {
  return {
    id: String(row.id),
    playerId: String(row.playerId ?? ""),
    player: String(row.player ?? ""),
    team: String(row.team ?? ""),
    opponent: String(row.opponent ?? ""),
    position: String(row.position ?? "SKILL"),
    market: row.market as NflProp["market"],
    side: row.side === "Under" ? "Under" : "Over",
    line: Number(row.line ?? 0),
    americanOdds: Number(row.americanOdds ?? -110),
    noVigProb: Number(row.noVigProb ?? 0.5),
    evPercent: Number(row.evPercent ?? 0),
    confidence: Number(row.confidence ?? 50),
    l5: String(row.l5 ?? "0/0"),
    l10: String(row.l10 ?? "0/0"),
    l20: String(row.l20 ?? "0/0"),
    season: String(row.season ?? "0/0"),
    tipTime: String(row.tipTime ?? ""),
    week: Number(row.week ?? 0),
    projectedSnapPct: Number(row.projectedSnapPct ?? 80),
    injury: "None",
    projectedValue: row.projectedValue != null ? Number(row.projectedValue) : undefined,
    edgePercent: row.edgePercent != null ? Number(row.edgePercent) : undefined,
  };
}

export default function ParlayBuilderPage() {
  const { legs, addLeg, removeLeg, setLegSide, clear, hasLeg } = useParlayDraft();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nba = useQuery({
    queryKey: ["nba-board"],
    queryFn: async () => {
      const res = await fetch("/api/nba/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{ props: Record<string, unknown>[] }>;
    },
    staleTime: 120_000,
  });

  const nfl = useQuery({
    queryKey: ["nfl-board"],
    queryFn: async () => {
      const res = await fetch("/api/nfl/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{ props: Record<string, unknown>[] }>;
    },
    staleTime: 120_000,
  });

  const nbaRows = useMemo(() => {
    const rows = (nba.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
    return rows;
  }, [nba.data?.props]);

  const nflRows = useMemo(() => {
    const rows = (nfl.data?.props ?? []).map(asNflProp);
    if (rows.length) cacheNflBoardProps(rows);
    return rows;
  }, [nfl.data?.props]);

  const suggestions: BuilderLeg[] = useMemo(
    () => [
      ...nbaRows.slice(0, 4).map(nbaToBuilderLeg),
      ...nflRows.slice(0, 3).map(nflToBuilderLeg),
    ],
    [nbaRows, nflRows],
  );

  const loading = (nba.isLoading || nfl.isLoading) && suggestions.length === 0;
  const selectedLeg = legs.find((l) => l.id === selectedId) ?? legs[0];
  const combinedEdge = legs.reduce((sum, l) => sum + (l.evPercent || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Workflow"
        title="Parlay Builder"
        description="Build multi-leg slips from Seraphim projections. Review L10 hit charts per leg before you lock."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/nba"
              className="rounded-lg border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 hover:border-yellow-500/30 hover:text-yellow-400"
            >
              Browse board
            </Link>
            <button
              type="button"
              onClick={() => clear()}
              className="rounded-lg border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 hover:border-yellow-500/30"
            >
              Clear slip
            </button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <ResearchPanel
            title={`Active slip · ${legs.length} leg${legs.length === 1 ? "" : "s"}`}
            subtitle={
              legs.length
                ? `Combined model EV signal ~ +${combinedEdge.toFixed(1)}% (not a priced parlay)`
                : "Add legs from suggestions or any research board"
            }
            featured={legs.length > 0}
          >
            {legs.length === 0 ? (
              <EmptyState
                title="Empty slip"
                description="Pick projection cards or open a league board to add legs."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {legs.map((leg) => (
                  <ParlayLegCard
                    key={leg.id}
                    leg={leg}
                    selected={selectedLeg?.id === leg.id}
                    onSelect={() => setSelectedId(leg.id)}
                    onSideChange={(side) => setLegSide(leg.id, side)}
                    onRemove={() => removeLeg(leg.id)}
                  />
                ))}
              </div>
            )}
            {selectedLeg && (
              <div className="mt-6 border-t border-[#1a1a1a] pt-5" data-feature="parlay-l10">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Selected leg · L10 vs line
                </p>
                <L10HitMissChart leg={selectedLeg} />
              </div>
            )}
          </ResearchPanel>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <ResearchPanel title="Suggested legs" subtitle="Top NBA + NFL warehouse props">
            {loading && <CardSkeleton rows={3} />}
            {!loading && suggestions.length === 0 && (
              <EmptyState
                title="No live props"
                description="Start the data platform, then open the NBA board."
                className="py-6"
              />
            )}
            <div className="grid gap-3">
              {nbaRows.slice(0, 3).map((p) => (
                <ProjectionCard
                  key={p.id}
                  prop={p}
                  onAdd={() => addLeg(nbaToBuilderLeg(p))}
                  added={hasLeg(p.id)}
                />
              ))}
              {nflRows.slice(0, 2).map((p) => (
                <ProjectionCard
                  key={p.id}
                  prop={p}
                  onAdd={() => addLeg(nflToBuilderLeg(p))}
                  added={hasLeg(p.id)}
                />
              ))}
            </div>
          </ResearchPanel>
        </div>
      </div>
    </div>
  );
}
