import { cn } from "@/lib/utils";
import { scoreHueStyle } from "@/lib/leanTheme";

/** Color-coded confidence (same red→orange→green scale as Research Score). */
export function ConfidenceBadge({
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
      title="Confidence — model certainty in the projection"
    >
      <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">Conf</span>
      {score}
    </span>
  );
}
