import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { CardSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import type { LeagueCode } from "@/data/mock";

type HubCard = {
  id: string;
  name: string;
  league: LeagueCode;
  team: string;
  opponent: string;
  position: string;
  initials: string;
  researchScore: number;
  headline: string;
  live?: boolean;
};

export default function PlayersHubPage() {
  const nba = useQuery({
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
      }>;
    },
    staleTime: 120_000,
  });

  const nfl = useQuery({
    queryKey: ["nfl-players-hub"],
    queryFn: async () => {
      const res = await fetch("/api/nfl/players");
      if (!res.ok) throw new Error("players");
      return res.json() as Promise<{
        players: Array<{
          id: string;
          name: string;
          team: string;
          opponent: string;
          position: string;
          headshotInitials: string;
          confidence?: number;
          researchScore?: number;
          matchupNote?: string;
        }>;
      }>;
    },
    staleTime: 120_000,
  });

  const players: HubCard[] = [
    ...(nba.data?.players ?? []).map(
      (p): HubCard => ({
        id: p.id,
        name: p.name,
        league: "NBA",
        team: p.team,
        opponent: p.opponent,
        position: p.position,
        initials: p.headshotInitials,
        researchScore: p.confidence,
        headline: p.matchupNote || "Live Seraphim profile",
        live: true,
      }),
    ),
    ...(nfl.data?.players ?? []).map(
      (p): HubCard => ({
        id: p.id,
        name: p.name,
        league: "NFL",
        team: p.team,
        opponent: p.opponent,
        position: p.position,
        initials: p.headshotInitials,
        researchScore: p.researchScore ?? p.confidence ?? 50,
        headline: p.matchupNote || "Live Seraphim profile",
        live: true,
      }),
    ),
  ].sort((a, b) => b.researchScore - a.researchScore);

  const loading = (nba.isLoading || nfl.isLoading) && players.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Player Profiles"
        description="Live NBA + NFL players from the warehouse. Other leagues appear when providers connect."
      />

      {loading && <CardSkeleton rows={3} />}

      {!loading && players.length === 0 && (
        <EmptyState
          title="No live players yet"
          description="Start the data platform and sync the NBA/NFL boards."
        />
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player) => (
          <Link
            key={`${player.league}-${player.id}`}
            href={`/player/${player.id}`}
            className="card-3d rounded-2xl border border-[#1a1a1a] bg-[#0c0c0c]/80 p-5 transition hover:border-yellow-500/25"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/35 bg-gradient-to-br from-yellow-400/20 to-amber-700/10 text-sm font-semibold text-yellow-300">
                {player.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{player.name}</p>
                    <p className="text-xs text-neutral-500">
                      {player.team} vs {player.opponent} · {player.position}
                    </p>
                  </div>
                  <ResearchScoreBadge score={player.researchScore} size="sm" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <LeagueBadge league={player.league} />
                  {player.live && (
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400/80">Live</span>
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-neutral-400">{player.headline}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
