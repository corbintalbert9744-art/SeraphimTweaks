import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ParlayLegCard } from "@/components/parlay/ParlayLegCard";
import { L10HitMissChart } from "@/components/parlay/L10HitMissChart";
import { mockNbaProps } from "@/data/nbaMock";
import { mockNflProps } from "@/data/nflMock";
import { mockTennisProps, tennisToBuilderLeg } from "@/data/tennisMock";
import { mockWnbaProps, wnbaToBuilderLeg } from "@/data/wnbaMock";
import { nbaToBuilderLeg, nflToBuilderLeg } from "@/lib/builderMappers";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export default function ParlayBuilderPage() {
  const { legs, addLeg, removeLeg, setLegSide, hasLeg, clear } = useParlayDraft();
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (legs.length === 0) {
      setFocusId(null);
      return;
    }
    if (!focusId || !legs.some((l) => l.id === focusId)) {
      setFocusId(legs[0].id);
    }
  }, [legs, focusId]);

  const focused = legs.find((l) => l.id === focusId) ?? legs[0];

  const quickAdds = [
    ...mockNbaProps.slice(0, 3).map(nbaToBuilderLeg),
    ...mockNflProps.slice(0, 2).map(nflToBuilderLeg),
    ...mockTennisProps.slice(0, 1).map(tennisToBuilderLeg),
    ...mockWnbaProps.slice(0, 1).map(wnbaToBuilderLeg),
  ].filter((p) => !hasLeg(p.id));

  const avgHitRate = useMemo(() => {
    if (legs.length === 0) return 0;
    return Math.round(legs.reduce((sum, l) => sum + l.l10Pct, 0) / legs.length);
  }, [legs]);

  const sameEventRisk = useMemo(() => {
    const keys = legs.map((l) => l.eventKey);
    return keys.some((key, i) => keys.indexOf(key) !== i);
  }, [legs]);

  return (
    <div>
      <PageHeader
        eyebrow="Tools"
        title="Parlay Builder"
        description="Build slips with Over/Under toggles, L10 hit rates, and the game log behind every number. Switch leagues from the sport tabs above."
      />

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Builder slip — matches mock card layout */}
        <section className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-white">Parlay Builder</h2>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-xs font-semibold tabular-nums text-emerald-300">
                {legs.length}
              </span>
            </div>
            {legs.length > 0 && (
              <button type="button" onClick={clear} className="text-sm text-neutral-500 transition hover:text-neutral-300">
                Clear
              </button>
            )}
          </div>

          <div className="space-y-3">
            {legs.map((leg) => (
              <ParlayLegCard
                key={leg.id}
                leg={leg}
                selected={focused?.id === leg.id}
                onSelect={() => setFocusId(leg.id)}
                onSideChange={(side) => setLegSide(leg.id, side)}
                onRemove={() => removeLeg(leg.id)}
              />
            ))}

            {legs.length === 0 && (
              <p className="rounded-2xl border border-dashed border-[#222] px-4 py-12 text-center text-sm text-neutral-500">
                No legs yet. Quick-add below or open a{" "}
                <Link href="/nba" className="text-yellow-400 hover:underline">
                  research board
                </Link>
                .
              </p>
            )}
          </div>

          {legs.length > 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-neutral-400">Avg hit rate (L10)</p>
                  <p className="mt-1 text-xs text-neutral-500">{legs.length} legs</p>
                </div>
                <p className="text-3xl font-semibold tabular-nums text-emerald-300">{avgHitRate}%</p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Quick add</h3>
            <div className="grid gap-2">
              {quickAdds.slice(0, 5).map((prop) => (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => {
                    addLeg(prop);
                    setFocusId(prop.id);
                  }}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-3 py-3 text-left transition hover:border-emerald-500/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-100">{prop.shortName}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {prop.marketCode} · {prop.line} · L10 {prop.l10Pct}%
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-emerald-400" />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* L10 game log + slip summary */}
        <div className="space-y-6 xl:col-span-3">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-yellow-500/90">
              03 — Confidence
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              See the game log behind every number
            </h2>
            <p className="mt-2 max-w-xl text-sm text-neutral-400">
              Hit/miss coloring for instant recognition — bars plotted against the live line for the focused leg.
            </p>
          </section>

          {focused ? (
            <L10HitMissChart leg={focused} className="card-3d animate-in fade-in duration-300" />
          ) : (
            <div className="card-3d rounded-2xl border border-dashed border-[#222] px-6 py-16 text-center text-sm text-neutral-500">
              Add a leg to unlock the Last 10 hit/miss chart.
            </div>
          )}

          <aside className="card-3d-popular rounded-2xl border border-yellow-500/25 p-5">
            <h2 className="text-base font-semibold text-white">Slip summary</h2>
            <p className="mt-1 text-xs text-neutral-400">Mock pricing until calc API is connected</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Avg L10</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">{avgHitRate}%</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Legs</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{legs.length}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500">Avg EV</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-yellow-400">
                  +
                  {legs.length === 0
                    ? "0.0"
                    : (legs.reduce((s, l) => s + l.evPercent, 0) / legs.length).toFixed(1)}
                  %
                </p>
              </div>
            </div>

            <div
              className={cn(
                "mt-4 rounded-xl border p-4 text-sm",
                sameEventRisk
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
              )}
            >
              {sameEventRisk
                ? "Same-game legs detected — conservative correlation policy would apply."
                : "No same-game collision in this mock slip."}
            </div>

            <button
              type="button"
              className="btn-3d mt-4 w-full rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 py-3 text-sm font-semibold text-black"
            >
              Save parlay (mock)
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
