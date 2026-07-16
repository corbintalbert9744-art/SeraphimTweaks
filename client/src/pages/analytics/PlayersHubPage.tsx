import { Lock } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { listPlayerProfiles, type PlayerProfile } from "@/data/playersMock";
import { useIsPro } from "@/components/membership/ProOnly";
import { cn } from "@/lib/utils";
import { CardSkeleton } from "@/components/shared/Skeleton";

type HubCard = {
  id: string;
  name: string;
  league: PlayerProfile["league"];
  team: string;
  opponent: string;
  position: string;
  initials: string;
  injury: string;
  tipTime: string;
  researchScore: number;
  aiExplain: { headline: string };
  live?: boolean;
};

export default function PlayersHubPage() {
  const isPro = useIsPro();

  const live = useQuery({
    queryKey: ["nba-players-hub"],
    queryFn: async () => {
      const res = await fetch("/api/nba/players");
      if (!res.ok) throw new Error("players");
      return res.json() as Promise<{
        players: Array<{
          id: string;
          name: string;
          team: string;
          opponent: string;
          position: string;
          headshotInitials: string;
          confidence: number;
          matchupNote: string;
        }>;
        live?: boolean;
      }>;
    },
    staleTime: 120_000,
  });

  const mockOthers = listPlayerProfiles()
    .filter((p) => p.league !== "NBA")
    .map(
      (p): HubCard => ({
        id: p.id,
        name: p.name,
        league: p.league,
        team: p.team,
        opponent: p.opponent,
        position: p.position,
        initials: p.initials,
        injury: p.injury,
        tipTime: p.tipTime,
        researchScore: p.researchScore,
        aiExplain: { headline: p.aiExplain.headline },
      }),
    );

  const liveNba: HubCard[] = (live.data?.players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    league: "NBA",
    team: p.team,
    opponent: p.opponent,
    position: p.position,
    initials: p.headshotInitials,
    injury: "None",
    tipTime: "Tonight",
    researchScore: p.confidence,
    aiExplain: { headline: p.matchupNote || "Live Seraphim profile" },
    live: true,
  }));

  // Prefer live NBA; fall back to mock NBA only if live unavailable
  const mockNbaFallback =
    liveNba.length === 0 && !live.isLoading
      ? listPlayerProfiles()
          .filter((p) => p.league === "NBA")
          .map(
            (p): HubCard => ({
              id: p.id,
              name: p.name,
              league: p.league,
              team: p.team,
              opponent: p.opponent,
              position: p.position,
              initials: p.initials,
              injury: p.injury,
              tipTime: p.tipTime,
              researchScore: p.researchScore,
              aiExplain: { headline: p.aiExplain.headline },
            }),
          )
      : [];

  const players = [...liveNba, ...mockNbaFallback, ...mockOthers].sort(
    (a, b) => b.researchScore - a.researchScore,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Player Profiles"
        description="Season averages, hit rates, splits, streaks, matchup context, and recommended props — open a profile to research before building."
      />

      {live.isLoading && liveNba.length === 0 && <CardSkeleton rows={3} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player, i) => (
          <Link
            key={`${player.league}-${player.id}`}
            href={`/player/${player.id}`}
            className="card-3d group rounded-2xl border border-[#1a1a1a] p-5 transition duration-300 hover:border-yellow-500/30"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300 transition group-hover:scale-105">
                  {player.initials}
                </div>
                <div>
                  <p className="font-semibold text-white group-hover:text-yellow-300">{player.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {player.team} · {player.position} · vs {player.opponent}
                  </p>
                </div>
              </div>
              <ResearchScoreBadge score={player.researchScore} size="sm" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LeagueBadge league={player.league} />
              {player.live && (
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                  Live
                </span>
              )}
              <span className="text-[11px] text-neutral-500">{player.tipTime}</span>
              <span
                className={
                  player.injury === "None" ? "text-[11px] text-emerald-400" : "text-[11px] text-amber-300"
                }
              >
                {player.injury === "None" ? "Healthy" : player.injury}
              </span>
            </div>
            <div className="relative mt-3 min-h-[2.5rem]">
              <p
                className={cn(
                  "line-clamp-2 text-xs leading-relaxed text-neutral-400",
                  !isPro && "select-none blur-[4px] opacity-50",
                )}
              >
                {player.aiExplain.headline}
              </p>
              {!isPro && (
                <div className="absolute inset-0 flex items-center">
                  <span className="inline-flex items-center gap-1 rounded-md border border-yellow-500/30 bg-[#0c0c0c]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
                    <Lock className="h-3 w-3" />
                    AI · Upgrade to Pro
                  </span>
                </div>
              )}
            </div>
            <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-yellow-500/80">
              Open Player Profile →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
