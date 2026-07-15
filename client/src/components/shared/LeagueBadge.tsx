import { cn } from "@/lib/utils";
import type { LeagueCode } from "@/data/mock";

const tones: Record<LeagueCode, string> = {
  NBA: "border-yellow-500/25 bg-yellow-500/10 text-yellow-400",
  NFL: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  WNBA: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  ATP: "border-lime-400/20 bg-lime-400/10 text-lime-300",
  WTA: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

export function LeagueBadge({ league, className }: { league: LeagueCode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        tones[league],
        className,
      )}
    >
      {league}
    </span>
  );
}
