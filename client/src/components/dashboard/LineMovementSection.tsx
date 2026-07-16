import { LeagueBadge } from "@/components/shared/LeagueBadge";
import type { LineMovementItem } from "@/data/mock";
import { cn } from "@/lib/utils";

function MiniSparkline({ series, favor }: { series: { value: number }[]; favor: boolean }) {
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 120;
  const height = 36;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke={favor ? "rgb(52, 211, 153)" : "rgb(251, 191, 36)"}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LineMovementSection({ items }: { items: LineMovementItem[] }) {
  return (
    <section className="card-3d rounded-2xl border border-[#1a1a1a] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Trending Line Movement</h2>
        <p className="text-xs text-neutral-500">Open → current (placeholder series)</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-[#1a1a1a] bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-neutral-100">{item.player}</p>
                <LeagueBadge league={item.league} />
              </div>
              <p className="text-xs text-neutral-500">{item.market}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {item.openLine} → <span className="text-neutral-200">{item.currentLine}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <MiniSparkline series={item.series} favor={item.direction === "favor"} />
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  item.direction === "favor"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-amber-500/10 text-amber-300",
                )}
              >
                {item.deltaLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
