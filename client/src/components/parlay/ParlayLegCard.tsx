import type { BuilderLeg } from "@/data/builderTypes";
import { cn } from "@/lib/utils";

export function ParlayLegCard({
  leg,
  selected,
  onSelect,
  onSideChange,
  onRemove,
}: {
  leg: BuilderLeg;
  selected?: boolean;
  onSelect?: () => void;
  onSideChange: (side: "Over" | "Under") => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
      className={cn(
        "rounded-2xl border bg-[#111] p-4 text-left transition",
        selected ? "border-emerald-500/40 shadow-[0_0_28px_-14px_rgba(16,185,129,0.55)]" : "border-[#1f1f1f] hover:border-neutral-700",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-neutral-700 to-neutral-900 text-[11px] font-semibold text-neutral-200">
            {leg.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{leg.shortName}</p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {leg.marketCode} · {leg.line}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-300">
            {leg.l10Pct}%
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="rounded-md px-1.5 text-xs text-neutral-600 hover:text-red-300"
            aria-label="Remove leg"
          >
            ×
          </button>
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-black/40 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {(["Over", "Under"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => onSideChange(side)}
            className={cn(
              "rounded-lg py-2 text-sm font-medium transition",
              leg.side === side
                ? "bg-emerald-600/90 text-white shadow-sm"
                : "text-neutral-500 hover:text-neutral-300",
            )}
          >
            {side}
          </button>
        ))}
      </div>
    </div>
  );
}
