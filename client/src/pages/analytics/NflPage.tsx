import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { NflFiltersBar, type NflBoardFilters } from "@/components/nfl/NflFiltersBar";
import { NflPropTable } from "@/components/nfl/NflPropTable";
import { NflPlayerCards } from "@/components/nfl/NflPlayerCards";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import {
  mockNflPlayerCards,
  mockNflProps,
  parseHitRate,
  type NflProp,
} from "@/data/nflMock";

const defaultFilters: NflBoardFilters = {
  query: "",
  market: "All",
  team: "All",
  side: "All",
  minConfidence: 60,
  sortKey: "ev",
  sortDir: "desc",
};

function sortProps(rows: NflProp[], filters: NflBoardFilters): NflProp[] {
  const dir = filters.sortDir === "asc" ? 1 : -1;
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
}

export default function NflPage() {
  const [filters, setFilters] = useState<NflBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const rows = mockNflProps.filter((prop) => {
      if (filters.market !== "All" && prop.market !== filters.market) return false;
      if (filters.team !== "All" && prop.team !== filters.team) return false;
      if (filters.side !== "All" && prop.side !== filters.side) return false;
      if (prop.confidence < filters.minConfidence) return false;
      if (!q) return true;
      return (
        prop.player.toLowerCase().includes(q) ||
        prop.team.toLowerCase().includes(q) ||
        prop.opponent.toLowerCase().includes(q) ||
        prop.market.toLowerCase().includes(q)
      );
    });
    return sortProps(rows, filters);
  }, [filters]);

  const avgEv =
    filtered.length === 0
      ? 0
      : filtered.reduce((sum, p) => sum + p.evPercent, 0) / filtered.length;

  const visiblePlayers = mockNflPlayerCards.filter((card) =>
    filtered.some((p) => p.playerId === card.id),
  );

  return (
    <div>
      <PageHeader
        eyebrow="NFL"
        title="NFL Research Board"
        description="Week 12 mock slate — pass/rush/receiving props with hit rates, no-vig, EV, and confidence. Add legs to the shared Parlay Builder."
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
            id: "nfl-props",
            label: "Props on board",
            value: String(filtered.length),
            delta: `${mockNflProps.length} total mock`,
            deltaTone: "neutral",
            hint: "After current filters",
          }}
        />
        <StatCard
          card={{
            id: "nfl-ev",
            label: "Avg EV (filtered)",
            value: `+${avgEv.toFixed(1)}%`,
            delta: "vs no-vig",
            deltaTone: "up",
            hint: "Mock fair reference",
          }}
        />
        <StatCard
          card={{
            id: "nfl-builder",
            label: "Legs in builder",
            value: String(legs.length),
            delta: legs.length ? "Ready to price" : "Empty slip",
            deltaTone: legs.length ? "up" : "neutral",
            hint: "Shared with NBA board",
          }}
        />
      </div>

      <div className="mt-6">
        <NflFiltersBar filters={filters} onChange={setFilters} resultCount={filtered.length} />
      </div>

      <div className="mt-6">
        <NflPlayerCards players={visiblePlayers.length ? visiblePlayers : mockNflPlayerCards} />
      </div>

      <div className="mt-6">
        <NflPropTable rows={filtered} />
      </div>
    </div>
  );
}
