import { useMemo } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { formatAmericanOdds, mockNbaProps } from "@/data/nbaMock";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export default function ParlayBuilderPage() {
  const { legs, addLeg, removeLeg, hasLeg, clear } = useParlayDraft();

  const available = mockNbaProps.filter((p) => !hasLeg(p.id)).slice(0, 8);

  const combinedEv =
    legs.length === 0
      ? 0
      : legs.reduce((sum, l) => sum + l.evPercent, 0) / legs.length;

  const sameEventRisk = useMemo(() => {
    const keys = legs.map((l) => `${l.team}-${l.opponent}-${l.tipTime}`);
    return keys.some((key, i) => keys.indexOf(key) !== i);
  }, [legs]);

  return (
    <div>
      <PageHeader
        eyebrow="Tools"
        title="Parlay Builder"
        description="Legs added from the NBA board appear here. Pricing is mocked until the calc API is connected."
        actions={
          <Link
            href="/nba"
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-4 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Back to NBA board
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Legs</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500">{legs.length} selected</span>
              {legs.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs text-neutral-500 hover:text-amber-300"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <ul className="space-y-3">
            {legs.map((leg) => (
              <li
                key={leg.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#1a1a1a] bg-black/25 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-100">{leg.player}</p>
                    <LeagueBadge league="NBA" />
                    <ResearchScoreBadge score={leg.confidence} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">
                    {leg.market} · {leg.side} {leg.line} · {formatAmericanOdds(leg.americanOdds)}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {leg.team} vs {leg.opponent} · EV +{leg.evPercent.toFixed(1)}% · No-vig{" "}
                    {(leg.noVigProb * 100).toFixed(1)}%
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-[#1a1a1a] p-2 text-neutral-400 transition hover:border-red-500/30 hover:text-red-300"
                  onClick={() => removeLeg(leg.id)}
                  aria-label="Remove leg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {legs.length === 0 && (
              <p className="rounded-xl border border-dashed border-[#222] px-4 py-10 text-center text-sm text-neutral-500">
                No legs yet. Add props from the{" "}
                <Link href="/nba" className="text-yellow-400 hover:underline">
                  NBA board
                </Link>
                .
              </p>
            )}
          </ul>

          <div className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Quick add from NBA mock board
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((prop) => (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => addLeg(prop)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] px-3 py-3 text-left transition hover:border-yellow-500/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-neutral-100">{prop.player}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {prop.market} {prop.side} {prop.line}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-yellow-400" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="card-3d-popular rounded-2xl border border-yellow-500/25 p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-white">Mock price</h2>
          <p className="mt-1 text-xs text-neutral-400">Independent product assumption · demo only</p>

          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-white/5 bg-black/30 p-4">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Combined EV (avg)</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-300">
                +{combinedEv.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 p-4">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Legs</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{legs.length}</p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-4 text-sm",
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
              className="btn-3d w-full rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 py-3 text-sm font-semibold text-black"
            >
              Save parlay (mock)
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
