import { cn } from "@/lib/utils";

/** Map Research Score → hue: low red → mid orange → high green. */
function scoreColor(score: number): { color: string; border: string; bg: string } {
  const t = Math.max(0, Math.min(1, (score - 50) / 45)); // 50 → 0, 95 → 1
  // Hue: 0° red → 32° orange → 142° green
  const hue = t < 0.45 ? (t / 0.45) * 32 : 32 + ((t - 0.45) / 0.55) * 110;
  const sat = 78;
  const light = 58;
  return {
    color: `hsl(${hue} ${sat}% ${light}%)`,
    border: `hsl(${hue} ${sat}% ${light}% / 0.4)`,
    bg: `hsl(${hue} ${sat}% ${light}% / 0.12)`,
  };
}

export function ResearchScoreBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md";
}) {
  const { color, border, bg } = scoreColor(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border font-semibold tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
      )}
      style={{ color, borderColor: border, backgroundColor: bg }}
      title="Research Score — checklist-backed, not win probability"
    >
      <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">RS</span>
      {score}
    </span>
  );
}
