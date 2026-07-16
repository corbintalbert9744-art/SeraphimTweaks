import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ParlayLegCard } from "@/components/parlay/ParlayLegCard";
import { L10HitMissChart } from "@/components/parlay/L10HitMissChart";
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
  };
}

export default function ParlayBuilderPage() {
  const { legs, addLeg, removeLeg, setLegSide, clear } = useParlayDraft();
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

  const suggestions: BuilderLeg[] = useMemo(() => {
    const nbaRows = (nba.data?.props ?? []).map(asNbaPropFromApi);
    if (nbaRows.length) cacheNbaBoardProps(nbaRows);
    const nflRows = (nfl.data?.props ?? []).map(asNflProp);
    if (nflRows.length) cacheNflBoardProps(nflRows);
    return [
      ...nbaRows.slice(0, 4).map(nbaToBuilderLeg),
      ...nflRows.slice(0, 3).map(nflToBuilderLeg),
    ];
  }, [nba.data?.props, nfl.data?.props]);

  const loading = (nba.isLoading || nfl.isLoading) && suggestions.length === 0;
  const selectedLeg = legs.find((l) => l.id === selectedId) ?? legs[0];

  return (
    <div>
      <PageHeader
        eyebrow="Builder"
        title="Parlay Builder"
        description="Add live NBA/NFL legs from the warehouse. Correlation and L10 charts use the active slip."
        actions={
          <button
            type="button"
            onClick={() => clear()}
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300"
          >
            Clear slip
          </button>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 xl:col-span-2">
          <h2 className="text-base font-semibold text-white">Slip ({legs.length})</h2>
          {legs.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              No legs yet — add from suggestions or any live board.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
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
            <div className="mt-6" data-feature="parlay-l10">
              <L10HitMissChart leg={selectedLeg} />
            </div>
          )}
        </section>

        <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
          <h2 className="text-base font-semibold text-white">Live suggestions</h2>
          <p className="mt-1 text-xs text-neutral-500">From NBA + NFL warehouse boards</p>
          {loading && <CardSkeleton rows={3} />}
          {!loading && suggestions.length === 0 && (
            <div className="mt-4">
              <EmptyState
                title="No live props"
                description="Open the NBA board after starting the data platform."
              />
              <Link href="/nba" className="mt-3 inline-block text-sm text-yellow-400 hover:underline">
                Go to NBA board
              </Link>
            </div>
          )}
          <ul className="mt-4 space-y-2">
            {suggestions.map((leg) => (
              <li key={leg.id}>
                <button
                  type="button"
                  onClick={() => addLeg(leg)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#1a1a1a] bg-black/25 px-3 py-3 text-left text-sm hover:border-yellow-500/30"
                >
                  <span className="text-neutral-200">
                    {leg.player} · {leg.market} {leg.side} {leg.line}
                  </span>
                  <span className="text-xs text-emerald-300">+{leg.evPercent.toFixed(1)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
