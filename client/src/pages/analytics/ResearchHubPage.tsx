import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { formatAmericanOdds, type PropDetail, registerPropDetails } from "@/data/propsCatalog";
import { asNbaPropFromApi, cacheNbaBoardProps, propDetailFromNbaProp } from "@/lib/nbaLiveCache";
import { cacheNflBoardProps } from "@/lib/addPropToBuilder";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { NflProp } from "@/data/nflMock";

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

function nflToDetail(p: NflProp): PropDetail {
  return {
    id: p.id,
    league: "NFL",
    playerId: p.playerId,
    player: p.player,
    team: p.team,
    opponent: p.opponent,
    position: p.position,
    market: p.market,
    side: p.side,
    line: p.line,
    americanOdds: p.americanOdds,
    noVigProb: p.noVigProb,
    noVigOpposite: Math.max(0.01, 1 - p.noVigProb),
    evPercent: p.evPercent,
    confidence: p.confidence,
    researchScore: p.confidence,
    dqs: Math.min(97, p.confidence + 3),
    l5: p.l5,
    l10: p.l10,
    l20: p.l20,
    season: p.season,
    tipTime: p.tipTime,
    why: `${p.side} ${p.line} ${p.market} — live model lean`,
    checks: [],
    books: [{ book: "Consensus", line: p.line, over: p.americanOdds, under: -110 }],
    movement: [{ label: "Now", line: p.line, odds: p.americanOdds }],
    analysis: [],
    opponentDefense: {
      rank: 16,
      of: 32,
      label: `vs ${p.position}`,
      note: "Live NFL warehouse",
    },
    similarPropIds: [],
  };
}

export default function ResearchHubPage() {
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

  const liveNba: PropDetail[] = (() => {
    const rows = (nba.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
    const details = rows.map((p) => propDetailFromNbaProp(p));
    registerPropDetails(details);
    return details;
  })();

  const liveNfl: PropDetail[] = (() => {
    const rows = (nfl.data?.props ?? []).map(asNflProp);
    if (rows.length) cacheNflBoardProps(rows);
    const details = rows.map(nflToDetail);
    registerPropDetails(details);
    return details;
  })();

  const props = [...liveNba, ...liveNfl].sort((a, b) => b.researchScore - a.researchScore);
  const loading = (nba.isLoading || nfl.isLoading) && props.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="Research Reports"
        description="Live NBA + NFL prop write-ups from the warehouse. Other leagues appear when providers go live."
        actions={
          <Link
            href="/players"
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Player Profiles
          </Link>
        }
      />

      {loading && <CardSkeleton rows={3} />}

      {!loading && props.length === 0 && (
        <EmptyState
          title="No live research reports"
          description="Start the data platform and open the NBA or NFL board to sync props."
        />
      )}

      {props.length > 0 && (
        <div className="card-3d overflow-hidden rounded-2xl border border-[#1a1a1a]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#1a1a1a] bg-black/30 text-[11px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium">Line</th>
                  <th className="px-4 py-3 font-medium">Odds</th>
                  <th className="px-4 py-3 font-medium">EV</th>
                  <th className="px-4 py-3 font-medium">Conf</th>
                  <th className="px-4 py-3 font-medium">RS</th>
                  <th className="px-4 py-3 font-medium">DQS</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]">
                {props.map((prop) => (
                  <tr key={prop.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-neutral-300">{prop.market}</td>
                    <td className="px-4 py-3 tabular-nums text-neutral-200">
                      {prop.side} {prop.line}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-neutral-200">
                      {formatAmericanOdds(prop.americanOdds)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        +{prop.evPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ResearchScoreBadge score={prop.confidence} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <ResearchScoreBadge score={prop.researchScore} size="sm" />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-neutral-400">{prop.dqs}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/prop/${prop.id}`} className="text-xs text-yellow-400 hover:underline">
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
