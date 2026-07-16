/** Shared Over / Under and score theming for premium analytics UI. */

import { cn } from "@/lib/utils";

export type LeanSide = "Over" | "Under";

export function isOver(side: string | null | undefined): boolean {
  return (side || "").toLowerCase() === "over";
}

/** Green for OVER · red for UNDER — use everywhere a lean is shown. */
export function leanTextClass(side: string | null | undefined): string {
  return isOver(side) ? "text-emerald-400" : "text-red-400";
}

export function leanBgClass(side: string | null | undefined): string {
  return isOver(side)
    ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
    : "border-red-500/35 bg-red-500/12 text-red-300";
}

export function leanSoftBgClass(side: string | null | undefined): string {
  return isOver(side) ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300";
}

/** Hit-rate string like "8/10" → percent 0–100. */
export function hitRatePercent(value: string | null | undefined): number {
  if (!value || value === "—") return 0;
  const [h, s] = value.split("/").map(Number);
  if (!s || !Number.isFinite(h) || !Number.isFinite(s)) return 0;
  return Math.round((h / s) * 100);
}

export function hitRateTextClass(value: string | null | undefined): string {
  const pct = hitRatePercent(value);
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 55) return "text-amber-300";
  if (pct > 0) return "text-red-400";
  return "text-neutral-500";
}

/** Continuous score color (Research / Confidence) — red → orange → green. */
export function scoreHueStyle(score: number): { color: string; border: string; bg: string } {
  const t = Math.max(0, Math.min(1, (score - 50) / 45));
  const hue = t < 0.45 ? (t / 0.45) * 32 : 32 + ((t - 0.45) / 0.55) * 110;
  const sat = 78;
  const light = 58;
  return {
    color: `hsl(${hue} ${sat}% ${light}%)`,
    border: `hsl(${hue} ${sat}% ${light}% / 0.4)`,
    bg: `hsl(${hue} ${sat}% ${light}% / 0.12)`,
  };
}

export function leanBadgeCn(side: string | null | undefined, className?: string): string {
  return cn(
    "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold uppercase tracking-wide",
    leanBgClass(side),
    className,
  );
}
