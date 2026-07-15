import { LeagueBadge } from "@/components/shared/LeagueBadge";
import { ResearchScoreBadge } from "@/components/shared/ResearchScoreBadge";
import type { EvLeader } from "@/data/mock";

export function HighestEvSection({ leaders }: { leaders: EvLeader[] }) {
  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Highest EV</h2>
          <p className="text-xs text-neutral-500">vs no-vig consensus · mock snapshot</p>
        </div>
      </div>
      <ul className="space-y-2.5">
        {leaders.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-[#1a1a1a] bg-black/20 px-3 py-3 transition hover:border-yellow-500/25"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-xs font-semibold text-yellow-400">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-neutral-100">{item.player}</p>
                <LeagueBadge league={item.league} />
              </div>
              <p className="truncate text-xs text-neutral-500">{item.market}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-emerald-300">+{item.evPercent.toFixed(1)}%</p>
              <div className="mt-1 flex justify-end">
                <ResearchScoreBadge score={item.researchScore} size="sm" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
