import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { listPropDetails, formatAmericanOdds, type PropDetail } from "@/data/propsCatalog";
import "@/data/registerLeagueProps";
import { asNbaPropFromApi, cacheNbaBoardProps, propDetailFromNbaProp } from "@/lib/nbaLiveCache";
import { CardSkeleton } from "@/components/shared/Skeleton";

export default function ResearchHubPage() {
  const live = useQuery({
    queryKey: ["nba-board"],
    queryFn: async () => {
      const res = await fetch("/api/nba/props");
      if (!res.ok) throw new Error("board");
      return res.json() as Promise<{ props: Record<string, unknown>[]; live?: boolean }>;
    },
    staleTime: 120_000,
  });

  const liveNba: PropDetail[] = (() => {
    const rows = (live.data?.props ?? []).map(asNbaPropFromApi);
    if (rows.length) cacheNbaBoardProps(rows);
    return rows.map((p) => propDetailFromNbaProp(p));
  })();

  const otherLeagues = listPropDetails().filter((p) => p.league !== "NBA");
  const mockNbaFallback =
    liveNba.length === 0 && !live.isLoading
      ? listPropDetails().filter((p) => p.league === "NBA")
      : [];

  const props = [...liveNba, ...mockNbaFallback, ...otherLeagues].sort(
    (a, b) => b.researchScore - a.researchScore,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="Research Reports"
        description="Full prop write-ups with Over/Under, sportsbook comparison, no-vig, EV, Confidence, Research Score, hit rates, and line movement. Use the sport tabs above to open a league board."
        actions={
          <Link
            href="/players"
            className="rounded-xl border border-[#1a1a1a] bg-[#111] px-3 py-2 text-sm text-neutral-300 transition hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Player Profiles
          </Link>
        }
      />

      {live.isLoading && liveNba.length === 0 && <CardSkeleton rows={3} />}

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
                  <td className="px-4 py-3 tabular-nums text-neutral-300">
                    {formatAmericanOdds(prop.americanOdds)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-emerald-300">+{prop.evPercent.toFixed(1)}%</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-300">{prop.confidence}</td>
                  <td className="px-4 py-3">
                    <ResearchScoreBadge score={prop.researchScore} size="sm" />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-400">{prop.dqs}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/prop/${prop.id}`} className="text-xs font-medium text-yellow-400 hover:underline">
                      Open report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
