import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { formatAmericanOdds, type PropDetail, registerPropDetails } from "@/data/propsCatalog";
import { asPropDetailFromApi } from "@/lib/nbaLiveCache";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { propResearchPath } from "@/lib/playerLinks";
import { HitRateMatrixCell } from "@/components/research";
import { usePickemApp } from "@/context/PickemAppContext";
import { PickemAppGate, PickemAppSwitcher } from "@/components/shared/PickemAppGate";
import type { LeagueCode } from "@/data/mock";

function isLivePickemRow(row: Record<string, unknown>): boolean {
  const id = String(row.id ?? "");
  if (id.includes(":pickem:")) return true;
  if (row.oddsAreMock === false) return true;
  if (row.oddsAreMock === true) return false;
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

function researchScore(row: Record<string, unknown>): number {
  return Math.max(
    Number(row.researchScore ?? 0),
    Number(row.confidence ?? 0),
    Number(row.evPercent ?? 0),
    Number(row.edgePercent ?? 0),
    Number(row.noVigProb != null ? (Number(row.noVigProb) - 0.5) * 100 : 0),
  );
}

function toHubDetail(row: Record<string, unknown>, leagueHint?: string): PropDetail {
  const league = leagueFromId(String(row.id ?? ""), leagueHint || String(row.league ?? ""));
  return asPropDetailFromApi({
    ...row,
    league,
    researchScore: researchScore(row) || Number(row.confidence ?? 50),
    why: row.why ?? `${row.side ?? "Over"} ${row.line} ${row.market} — live pick'em`,
    books: Array.isArray(row.books) ? row.books : Array.isArray(row.lines) ? row.lines : [],
  });
}

async function fetchBoardProps(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(path);
  if (!res.ok) return [];
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return [];
  const data = (await res.json()) as { props?: Record<string, unknown>[] };
  return Array.isArray(data.props) ? data.props : [];
}

const LEAGUES: Array<LeagueCode | "All"> = [
  "All",
  "NBA",
  "WNBA",
  "NFL",
  "MLB",
  "NHL",
  "Soccer",
  "ATP",
  "WTA",
];

export default function ResearchHubPage() {
  const { appId, app, ready } = usePickemApp();
  const platform = appId || "prizepicks";
  const [leagueFilter, setLeagueFilter] = useState<(typeof LEAGUES)[number]>("All");

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
    queryKey: ["research-hub-live", platform],
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

  const props = useMemo(() => {
    const byId = new Map<string, PropDetail>();

    const ingest = (rows: Record<string, unknown>[], leagueHint?: string) => {
      for (const row of rows) {
        if (!isLivePickemRow(row)) continue;
        if (!row.id || row.player == null || row.line == null) continue;
        const detail = toHubDetail(row, leagueHint);
        if (!detail.player || !Number.isFinite(detail.line)) continue;
        const prev = byId.get(detail.id);
        if (!prev || detail.researchScore > prev.researchScore) {
          byId.set(detail.id, detail);
        }
      }
    };

    ingest(commandCenter.data?.bestNoVigPicks ?? []);
    ingest(commandCenter.data?.topProps ?? []);
    if (commandCenter.data?.propOfTheDay) {
      ingest([commandCenter.data.propOfTheDay]);
    }
    ingest(liveBoards.data ?? []);

    const list = Array.from(byId.values()).sort((a, b) => b.researchScore - a.researchScore);
    registerPropDetails(list);
    return list;
  }, [commandCenter.data, liveBoards.data]);

  const filtered = useMemo(() => {
    if (leagueFilter === "All") return props;
    return props.filter((p) => p.league === leagueFilter);
  }, [props, leagueFilter]);

  const loading =
    ready &&
    (commandCenter.isLoading || liveBoards.isLoading) &&
    props.length === 0;

  if (!ready) {
    return (
      <div>
        <PageHeader
          eyebrow="Research desk"
          title="Research Hub"
          description="Live optional picks from your connected pick'em app — no mock warehouse lines."
        />
        <PickemAppGate />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Research desk"
        title="Research Hub"
        description={`Live ${app?.name || "pick'em"} props across leagues — open any row for hit rates, projections, and Live Odds Comparison.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PickemAppSwitcher />
            <Link
              href="/players"
              className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
            >
              Player Profiles
            </Link>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {LEAGUES.map((lg) => (
          <button
            key={lg}
            type="button"
            onClick={() => setLeagueFilter(lg)}
            className={
              leagueFilter === lg
                ? "rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-300"
                : "rounded-lg border border-transparent bg-white/[0.03] px-2.5 py-1 text-[11px] text-neutral-400 hover:border-white/10 hover:text-neutral-200"
            }
          >
            {lg}
          </button>
        ))}
        <span className="ml-auto text-[11px] tabular-nums text-neutral-500">
          {filtered.length} live pick{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading && <CardSkeleton rows={3} />}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="No live optional picks right now"
          description={`No live ${app?.name || "pick'em"} lines for ${leagueFilter === "All" ? "any league" : leagueFilter}. Switch apps or check back when the slate is open — mock warehouse odds are never shown here.`}
        />
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-[#0d0d0d]">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="border-b border-[#1a1a1a] bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Player</th>
                  <th className="px-3 py-2.5 font-medium">Market</th>
                  <th className="px-3 py-2.5 font-medium">Line</th>
                  <th className="px-3 py-2.5 font-medium text-right">L10</th>
                  <th className="px-3 py-2.5 font-medium">Odds</th>
                  <th className="px-3 py-2.5 font-medium">EV</th>
                  <th className="px-3 py-2.5 font-medium">RS</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]">
                {filtered.map((prop) => (
                  <tr key={prop.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <LeagueBadge league={prop.league} />
                        <div>
                          <p className="font-medium text-neutral-100">{prop.player}</p>
                          <p className="text-[11px] text-neutral-500">
                            {prop.team} vs {prop.opponent}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-neutral-300">{prop.market}</td>
                    <td className="px-3 py-3 tabular-nums text-neutral-200">
                      {prop.side} {prop.line}
                    </td>
                    <td className="px-3 py-3">
                      <HitRateMatrixCell value={prop.l10} />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-neutral-200">
                      {formatAmericanOdds(prop.americanOdds)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        +{Number(prop.evPercent || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ResearchScoreBadge score={prop.researchScore} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link href={propResearchPath(prop.id)} className="text-xs text-yellow-400 hover:underline">
                        Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
