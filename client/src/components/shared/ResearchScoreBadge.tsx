import { cn } from "@/lib/utils";

export function ResearchScoreBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md";
}) {
  const tone =
    score >= 90
      ? "text-yellow-300 border-yellow-500/40 bg-yellow-500/10"
      : score >= 75
        ? "text-amber-200 border-amber-500/30 bg-amber-500/10"
        : "text-neutral-300 border-neutral-600/40 bg-neutral-500/10";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border font-semibold tabular-nums",
        tone,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
      )}
      title="Research Score — checklist-backed, not win probability"
    >
      <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">RS</span>
      {score}
    </span>
  );
}
