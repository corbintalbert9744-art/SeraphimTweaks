import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import {
  formatAmericanOdds,
  mockTennisPlayerCards,
  mockTennisProps,
  parseHitRate,
  tennisMarketOptions,
  tennisToBuilderLeg,
  type TennisMarket,
  type TennisProp,
} from "@/data/tennisMock";
import { cn } from "@/lib/utils";

type SortKey = "ev" | "confidence" | "noVig" | "l10" | "player" | "line";

interface Filters {
  query: string;
  market: TennisMarket | "All";
  side: "All" | "Over" | "Under";
  minConfidence: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
}

export default function TennisPage({ tour }: { tour: "ATP" | "WTA" }) {
  const { legs, addLeg, hasLeg } = useParlayDraft();
  const [filters, setFilters] = useState<Filters>({
    query: "",
    market: "All",
    side: "All",
    minConfidence: 60,
    sortKey: "ev",
    sortDir: "desc",
  });

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const dir = filters.sortDir === "asc" ? 1 : -1;
    const rows = mockTennisProps.filter((p) => {
      if (p.league !== tour) return false;
      if (filters.market !== "All" && p.market !== filters.market) return false;
      if (filters.side !== "All" && p.side !== filters.side) return false;
      if (p.confidence < filters.minConfidence) return false;
      if (!q) return true;
      return (
        p.player.toLowerCase().includes(q) ||
        p.opponent.toLowerCase().includes(q) ||
        p.tournament.toLowerCase().includes(q)
      );
    });
    return [...rows].sort((a, b) => {
      switch (filters.sortKey) {
        case "ev":
          return (a.evPercent - b.evPercent) * dir;
        case "confidence":
          return (a.confidence - b.confidence) * dir;
        case "noVig":
          return (a.noVigProb - b.noVigProb) * dir;
        case "l10":
          return (parseHitRate(a.l10) - parseHitRate(b.l10)) * dir;
        case "line":
          return (a.line - b.line) * dir;
        case "player":
          return a.player.localeCompare(b.player) * dir;
        default:
          return 0;
      }
    });
  }, [filters, tour]);

  const cards = mockTennisPlayerCards.filter((c) => c.league === tour);
  const avgEv =
    filtered.length === 0
      ? 0
      : filtered.reduce((s, p) => s + p.evPercent, 0) / filtered.length;

  return (
    <div>
      <PageHeader
        eyebrow={`${tour} Tennis`}
        title={`${tour} Research Board`}
        description="Match markets and totals with form windows, no-vig, EV, and confidence — Miami Open mock slate."
        actions={
          <Link
            href="/parlay-builder"
            className="btn-3d rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Parlay Builder{legs.length > 0 ? ` (${legs.length})` : ""}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          card={{
            id: "t-props",
            label: "Props on board",
            value: String(filtered.length),
            delta: `${tour} mock`,
            deltaTone: "neutral",
            hint: "After filters",
          }}
        />
        <StatCard
          card={{
            id: "t-ev",
            label: "Avg EV",
            value: `+${avgEv.toFixed(1)}%`,
            delta: "vs no-vig",
            deltaTone: "up",
            hint: "Mock fair reference",
          }}
        />
        <StatCard
          card={{
            id: "t-legs",
            label: "Legs in builder",
            value: String(legs.length),
            delta: "Cross-sport slip",
            deltaTone: legs.length ? "up" : "neutral",
            hint: "Shared draft",
          }}
        />
      </div>

      <section className="card-3d mt-6 rounded-2xl border border-[#1a1a1a] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full max-w-md">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                placeholder="Player, opponent, tournament…"
                className="h-11 w-full rounded-xl border border-[#1a1a1a] bg-[#111] pl-10 pr-3 text-sm text-neutral-100 outline-none focus:border-yellow-500/40"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.market}
              onChange={(e) => setFilters({ ...filters, market: e.target.value as Filters["market"] })}
              className="h-11 rounded-xl border border-[#1a1a1a] bg-[#111] px-3 text-sm text-neutral-200"
            >
              {tennisMarketOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={filters.side}
              onChange={(e) => setFilters({ ...filters, side: e.target.value as Filters["side"] })}
              className="h-11 rounded-xl border border-[#1a1a1a] bg-[#111] px-3 text-sm text-neutral-200"
            >
              {["All", "Over", "Under"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filters.sortKey}
              onChange={(e) => setFilters({ ...filters, sortKey: e.target.value as SortKey })}
              className="h-11 rounded-xl border border-[#1a1a1a] bg-[#111] px-3 text-sm text-neutral-200"
            >
              <option value="ev">Sort: EV</option>
              <option value="confidence">Sort: Confidence</option>
              <option value="noVig">Sort: No-Vig</option>
              <option value="l10">Sort: L10</option>
              <option value="player">Sort: Player</option>
              <option value="line">Sort: Line</option>
            </select>
            <button
              type="button"
              onClick={() =>
                setFilters({ ...filters, sortDir: filters.sortDir === "desc" ? "asc" : "desc" })
              }
              className="h-11 rounded-xl border border-[#1a1a1a] bg-[#111] px-4 text-sm text-neutral-300"
            >
              {filters.sortDir === "desc" ? "High → Low" : "Low → High"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-4 text-base font-semibold text-white">Featured players</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const top = mockTennisProps.find((p) => p.id === card.topPropId);
            const added = top ? hasLeg(top.id) : false;
            return (
              <article key={card.id} className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-sm font-semibold text-yellow-300">
                    {card.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white">{card.name}</h3>
                        <p className="text-xs text-neutral-500">
                          #{card.ranking} · vs {card.opponent} · {card.surface}
                        </p>
                      </div>
                      <ResearchScoreBadge score={card.confidence} size="sm" />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-neutral-400">{card.matchupNote}</p>
                <p className="mt-2 text-[11px] text-neutral-500">Form · {card.form}</p>
                {top && (
                  <div className="mt-4 flex items-center justify-between border-t border-[#151515] pt-4">
                    <Link href={`/prop/${top.id}`} className="text-sm text-neutral-200 hover:text-yellow-400">
                      {top.market} · +{top.evPercent.toFixed(1)}%
                    </Link>
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addLeg(tennisToBuilderLeg(top))}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                        added
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
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

      <TennisTable rows={filtered} />
    </div>
  );
}

function TennisTable({ rows }: { rows: TennisProp[] }) {
  const { addLeg, hasLeg } = useParlayDraft();
  return (
    <section className="card-3d mt-6 overflow-hidden rounded-2xl border border-[#1a1a1a]">
      <div className="border-b border-[#1a1a1a] px-5 py-4">
        <h2 className="text-base font-semibold text-white">Prop board</h2>
        <p className="text-xs text-neutral-500">L5 · L10 · L20 · Season · No-Vig · EV · Confidence</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-white/[0.02] text-[11px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Line</th>
              <th className="px-4 py-3 font-medium">Odds</th>
              <th className="px-4 py-3 font-medium">L5</th>
              <th className="px-4 py-3 font-medium">L10</th>
              <th className="px-4 py-3 font-medium">L20</th>
              <th className="px-4 py-3 font-medium">Season</th>
              <th className="px-4 py-3 font-medium">No-Vig</th>
              <th className="px-4 py-3 font-medium">EV</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium text-right">Builder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151515]">
            {rows.map((row) => {
              const added = hasLeg(row.id);
              const lineLabel =
                row.market === "Match Winner" ? "ML" : `${row.side} ${row.line}`;
              return (
                <tr key={row.id} className="hover:bg-yellow-500/[0.03]">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-neutral-100">{row.player}</p>
                    <p className="text-xs text-neutral-500">
                      vs {row.opponent} · {row.tournament} · {row.surface}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/prop/${row.id}`} className="text-neutral-300 hover:text-yellow-400">
                      {row.market}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-200">{lineLabel}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-200">
                    {formatAmericanOdds(row.americanOdds)}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.l5}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.l10}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.l20}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-300">{row.season}</td>
                  <td className="px-4 py-3.5 tabular-nums text-neutral-200">
                    {(row.noVigProb * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                      +{row.evPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <ResearchScoreBadge score={row.confidence} size="sm" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      disabled={added}
                      onClick={() => addLeg(tennisToBuilderLeg(row))}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                        added
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
                      )}
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {added ? "Added" : "Add to Builder"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-sm text-neutral-500">
                  No props match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
