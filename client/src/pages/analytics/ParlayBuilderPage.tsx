import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { ParlayLegCard } from "@/components/parlay/ParlayLegCard";
import { L10HitMissChart } from "@/components/parlay/L10HitMissChart";
import { ProjectionCard, ResearchPanel } from "@/components/research";
import { usePickemApp } from "@/context/PickemAppContext";
import { PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import { withLegHitData } from "@/lib/legStats";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton } from "@/components/shared/Skeleton";
import type { BuilderLeg } from "@/data/builderTypes";
import type { LeagueCode } from "@/data/mock";
import type { ProjectionCardProp } from "@/components/research";

type LiveSuggestion = ProjectionCardProp & {
  playerId: string;
  americanOdds: number;
  tipTime?: string;
  oddsAreMock?: boolean;
  live?: boolean;
};

function isLivePickemRow(row: Record<string, unknown>): boolean {
  const id = String(row.id ?? "");
  if (id.includes(":pickem:")) return true;
  if (row.oddsAreMock === false) return true;
  if (row.oddsAreMock === true) return false;
  // Warehouse comparison lines without pick'em id are not suggested as live legs
  return false;
}

function leagueFromId(id: string, fallback?: string): LeagueCode {
  const prefix = id.split(":")[0]?.toLowerCase();
  const map: Record<string, LeagueCode> = {
    nba: "NBA",
    wnba: "WNBA",
    nfl: "NFL",
    mlb: "MLB",
    nhl: "NHL",
    soccer: "Soccer",
    atp: "ATP",
    wta: "WTA",
  };
  if (prefix && map[prefix]) return map[prefix];
  const f = String(fallback || "NBA").toUpperCase();
  if (f === "ATP" || f === "WTA" || f === "SOCCER") return f as LeagueCode;
  if (["NBA", "NFL", "MLB", "NHL", "WNBA"].includes(f)) return f as LeagueCode;
  return "NBA";
}

function asLiveSuggestion(row: Record<string, unknown>, leagueHint?: string): LiveSuggestion {
  const id = String(row.id ?? "");
  return {
    id,
    playerId: String(row.playerId ?? row.playerExternalId ?? id),
    player: String(row.player ?? ""),
    team: String(row.team ?? ""),
    opponent: String(row.opponent ?? ""),
    market: String(row.market ?? ""),
    side: row.side === "Under" ? "Under" : "Over",
    line: Number(row.line ?? 0),
    league: leagueFromId(id, leagueHint || String(row.league ?? "")),
    projectedValue: row.projectedValue != null ? Number(row.projectedValue) : null,
    edgePercent:
      row.edgePercent != null
        ? Number(row.edgePercent)
        : row.noVigEdgePct != null
          ? Number(row.noVigEdgePct)
          : row.evPercent != null
            ? Number(row.evPercent)
            : null,
    edgeVsLine: row.edgeVsLine != null ? Number(row.edgeVsLine) : null,
    noVigProb: row.noVigProb != null ? Number(row.noVigProb) : null,
    evPercent: row.evPercent != null ? Number(row.evPercent) : null,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    researchScore: row.researchScore != null ? Number(row.researchScore) : null,
    l5: row.l5 != null ? String(row.l5) : undefined,
    l10: row.l10 != null ? String(row.l10) : undefined,
    l20: row.l20 != null ? String(row.l20) : undefined,
    season: row.season != null ? String(row.season) : undefined,
    americanOdds: Number(row.americanOdds ?? -110),
    tipTime: row.tipTime != null ? String(row.tipTime) : undefined,
    oddsAreMock: row.oddsAreMock === true,
    live: true,
  };
}

function toBuilderLeg(p: LiveSuggestion): BuilderLeg {
  return withLegHitData({
    id: p.id,
    league: (p.league as LeagueCode) || "NBA",
    playerId: p.playerId,
    player: p.player,
    team: p.team || "",
    opponent: p.opponent || "",
    position: "",
    market: p.market,
    side: p.side === "Under" ? "Under" : "Over",
    line: p.line,
    americanOdds: p.americanOdds,
    noVigProb: Number(p.noVigProb ?? 0.5),
    evPercent: Number(p.evPercent ?? p.edgePercent ?? 0),
    confidence: Number(p.confidence ?? p.researchScore ?? 50),
    tipTime: p.tipTime || "",
    eventKey: `${p.team}-${p.opponent}-${p.tipTime || p.id}`,
    l10: p.l10 || "0/0",
  });
}

function rankScore(p: LiveSuggestion): number {
  return Math.max(
    Number(p.edgePercent ?? 0),
    Number(p.evPercent ?? 0),
    Number(p.noVigProb != null ? (p.noVigProb - 0.5) * 100 : 0),
  );
}

async function fetchBoardProps(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(path);
  if (!res.ok) return [];
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return [];
  const data = (await res.json()) as { props?: Record<string, unknown>[] };
  return Array.isArray(data.props) ? data.props : [];
}

export default function ParlayBuilderPage() {
  const { legs, addLeg, removeLeg, setLegSide, clear, hasLeg } = useParlayDraft();
  const { appId, app, ready } = usePickemApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const platform = appId || "prizepicks";

  const commandCenter = useQuery({
    queryKey: ["command-center"],
    queryFn: async () => {
      const res = await fetch("/api/command-center");
      if (!res.ok) throw new Error("cc");
      return res.json() as Promise<{
        generatedAt?: string;
        topProps?: Record<string, unknown>[];
        bestNoVigPicks?: Record<string, unknown>[];
        propOfTheDay?: Record<string, unknown> | null;
      }>;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const liveBoards = useQuery({
    queryKey: ["parlay-live-suggestions", platform],
    enabled: ready,
    queryFn: async () => {
      const qs = `platform=${encodeURIComponent(platform)}`;
      const batches = await Promise.all([
        fetchBoardProps(`/api/wnba/props?${qs}`),
        fetchBoardProps(`/api/mlb/props?${qs}`),
        fetchBoardProps(`/api/nhl/props?${qs}`),
        fetchBoardProps(`/api/soccer/props?${qs}`),
        fetchBoardProps(`/api/tennis/props?tour=ATP&${qs}`),
        fetchBoardProps(`/api/tennis/props?tour=WTA&${qs}`),
        fetchBoardProps(`/api/nba/props?${qs}`),
        fetchBoardProps(`/api/nfl/props?${qs}`),
      ]);
      return batches.flat();
    },
    staleTime: 90_000,
    refetchInterval: 300_000,
  });

  const liveSuggestions = useMemo(() => {
    const byId = new Map<string, LiveSuggestion>();

    const ingest = (rows: Record<string, unknown>[], leagueHint?: string) => {
      for (const row of rows) {
        if (!isLivePickemRow(row)) continue;
        if (!row.id || row.player == null || row.line == null) continue;
        const s = asLiveSuggestion(row, leagueHint);
        if (!s.player || !Number.isFinite(s.line)) continue;
        const prev = byId.get(s.id);
        if (!prev || rankScore(s) > rankScore(prev)) byId.set(s.id, s);
      }
    };

    // Prefer today's command-center ranked live slate first
    ingest(commandCenter.data?.bestNoVigPicks ?? []);
    ingest(commandCenter.data?.topProps ?? []);
    if (commandCenter.data?.propOfTheDay) {
      ingest([commandCenter.data.propOfTheDay]);
    }
    // Then fill from live pick'em boards for the selected platform
    ingest(liveBoards.data ?? []);

    return Array.from(byId.values())
      .sort((a, b) => rankScore(b) - rankScore(a))
      .slice(0, 8);
  }, [commandCenter.data, liveBoards.data]);

  const loading =
    (commandCenter.isLoading || liveBoards.isLoading) && liveSuggestions.length === 0;
  const selectedLeg = legs.find((l) => l.id === selectedId) ?? legs[0];
  const combinedEdge = legs.reduce((sum, l) => sum + (l.evPercent || 0), 0);
  const liveUpdated =
    commandCenter.data?.generatedAt != null
      ? new Date(commandCenter.data.generatedAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Workflow"
        title="Parlay Builder"
        description="Suggested legs come from today’s live pick’em slate — not demo examples."
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PickemAppSwitcher />
        <p className="text-xs text-neutral-500">
          {app ? `${app.name} live slate` : "PrizePicks live slate (default)"}
          {liveUpdated ? ` · updated ${liveUpdated}` : ""}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <ResearchPanel
            title={`Active slip · ${legs.length} leg${legs.length === 1 ? "" : "s"}`}
            subtitle={
              legs.length
                ? `Combined model EV signal ~ +${combinedEdge.toFixed(1)}% (not a priced parlay)`
                : "Add live suggested legs or open any research board"
            }
            featured={legs.length > 0}
          >
            {legs.length === 0 ? (
              <EmptyState
                title="Empty slip"
                description="Add from the live suggestions on the right."
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
          <ResearchPanel
            title="Suggested legs"
            subtitle={`Live pick’em only · ${liveSuggestions.length} ranked by edge`}
            action={
              <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Live
              </span>
            }
          >
            {loading && <CardSkeleton rows={3} />}
            {!loading && liveSuggestions.length === 0 && (
              <EmptyState
                title="No live pick’em legs yet"
                description="Sync a pick’em platform board (WNBA/MLB/etc.) or wait for Command Center refresh."
                className="py-6"
              />
            )}
            <div className="grid gap-3">
              {liveSuggestions.map((p) => (
                <ProjectionCard
                  key={p.id}
                  prop={p}
                  onAdd={() => addLeg(toBuilderLeg(p))}
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
