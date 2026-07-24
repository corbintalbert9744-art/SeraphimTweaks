import { cn } from "@/lib/utils";
import { leanBadgeCn, leanTextClass, type LeanSide } from "@/lib/leanTheme";

/** Immediately obvious Over (green) / Under (red) recommendation. */
export function LeanBadge({
  side,
  line,
  size = "md",
  showLine = true,
  className,
}: {
  side: LeanSide | string;
  line?: number;
  size?: "sm" | "md" | "lg";
  showLine?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        leanBadgeCn(side),
        size === "sm" && "px-1.5 py-0.5 text-[10px]",
        size === "lg" && "px-3 py-1.5 text-sm",
        className,
      )}
      title={`Model recommends ${side}`}
    >
      <span>{side}</span>
      {showLine && line != null && (
        <span className="tabular-nums font-semibold opacity-95">{line}</span>
      )}
    </span>
  );
}

export function LeanText({
  side,
  line,
  className,
}: {
  side: LeanSide | string;
  line?: number;
  className?: string;
}) {
  return (
    <span className={cn("font-semibold tabular-nums", leanTextClass(side), className)}>
      {side}
      {line != null ? ` ${line}` : ""}
    </span>
  );
}
