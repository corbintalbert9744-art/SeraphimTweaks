import { cn } from "@/lib/utils";
import { scoreHueStyle } from "@/lib/leanTheme";

/** Map Research Score → hue: low red → mid orange → high green. */
export function ResearchScoreBadge({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const { color, border, bg } = scoreHueStyle(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border font-semibold tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className,
      )}
      style={{ color, borderColor: border, backgroundColor: bg }}
      title="Research Score — checklist-backed, not win probability"
    >
      <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">RS</span>
      {score}
    </span>
  );
}
