import { useMemo, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { NbaFiltersBar, type NbaBoardFilters } from "@/components/nba/NbaFiltersBar";
import { NbaPropTable } from "@/components/nba/NbaPropTable";
import { NbaPlayerCards } from "@/components/nba/NbaPlayerCards";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import {
  mockNbaPlayerCards,
  mockNbaProps,
  parseHitRate,
  type NbaProp,
} from "@/data/nbaMock";

const defaultFilters: NbaBoardFilters = {
  query: "",
  market: "All",
  team: "All",
  side: "All",
  minConfidence: 60,
  sortKey: "ev",
  sortDir: "desc",
};

function sortProps(rows: NbaProp[], filters: NbaBoardFilters): NbaProp[] {
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

export default function NbaPage() {
  const [filters, setFilters] = useState<NbaBoardFilters>(defaultFilters);
  const { legs } = useParlayDraft();

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const rows = mockNbaProps.filter((prop) => {
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

  const visiblePlayers = mockNbaPlayerCards.filter((card) =>
    filtered.some((p) => p.playerId === card.id),
  );

  return (
    <div>
      <PageHeader
        eyebrow="NBA"
        title="NBA Research Board"
        description="Filter the slate, inspect hit rates and no-vig pricing, then add legs to the Parlay Builder — all mock data for V1 UI."
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
            id: "nba-props",
            label: "Props on board",
            value: String(filtered.length),
            delta: `${mockNbaProps.length} total mock`,
            deltaTone: "neutral",
            hint: "After current filters",
          }}
        />
        <StatCard
          card={{
            id: "nba-ev",
            label: "Avg EV (filtered)",
            value: `+${avgEv.toFixed(1)}%`,
            delta: "vs no-vig",
            deltaTone: "up",
            hint: "Mock fair reference",
          }}
        />
        <StatCard
          card={{
            id: "nba-builder",
            label: "Legs in builder",
            value: String(legs.length),
            delta: legs.length ? "Ready to price" : "Empty slip",
            deltaTone: legs.length ? "up" : "neutral",
            hint: "Shared draft across pages",
          }}
        />
      </div>

      <div className="mt-6">
        <NbaFiltersBar filters={filters} onChange={setFilters} resultCount={filtered.length} />
      </div>

      <div className="mt-6">
        <NbaPlayerCards players={visiblePlayers.length ? visiblePlayers : mockNbaPlayerCards} />
      </div>

      <div className="mt-6">
        <NbaPropTable rows={filtered} />
      </div>
    </div>
  );
}
