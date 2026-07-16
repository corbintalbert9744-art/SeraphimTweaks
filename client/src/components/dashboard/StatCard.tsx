import { cn } from "@/lib/utils";
import type { StatCardData } from "@/data/mock";

export function StatCard({ card }: { card: StatCardData }) {
  return (
    <div className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{card.label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">{card.value}</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            card.deltaTone === "up" && "bg-emerald-500/10 text-emerald-300",
            card.deltaTone === "down" && "bg-amber-500/10 text-amber-300",
            card.deltaTone === "neutral" && "bg-white/5 text-neutral-400",
          )}
        >
          {card.delta}
        </span>
      </div>
      <p className="mt-3 text-xs text-neutral-500">{card.hint}</p>
    </div>
  );
}
