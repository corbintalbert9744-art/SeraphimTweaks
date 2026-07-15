import { Lock } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shared/PageHeader";
import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import { listPlayerProfiles } from "@/data/playersMock";
import { useIsPro } from "@/components/membership/ProOnly";
import { cn } from "@/lib/utils";

export default function PlayersHubPage() {
  const players = listPlayerProfiles().sort((a, b) => b.researchScore - a.researchScore);
  const isPro = useIsPro();

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Player Profiles"
        description="Season averages, hit rates, splits, streaks, matchup context, and recommended props — open a profile to research before building."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {players.map((player, i) => (
          <Link
            key={player.id}
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
