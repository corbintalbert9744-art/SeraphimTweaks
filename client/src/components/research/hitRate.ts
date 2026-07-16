/** Shared hit-rate parsing for research boards and prop reports. */

export type HitWindow = "L5" | "L10" | "L20" | "Season";

export type ParsedHitRate = {
  hits: number;
  samples: number;
  pct: number;
  label: string;
};

export function parseHitRate(value: string | null | undefined): ParsedHitRate {
  if (!value) return { hits: 0, samples: 0, pct: 0, label: "—" };
  const [hitsRaw, samplesRaw] = String(value).split("/");
  const hits = Number(hitsRaw);
  const samples = Number(samplesRaw);
  const h = Number.isFinite(hits) ? hits : 0;
  const s = Number.isFinite(samples) ? samples : 0;
  return {
    hits: h,
    samples: s,
    pct: s ? Math.round((h / s) * 100) : 0,
    label: s ? `${h}/${s}` : "—",
  };
}

export function hitToneClass(pct: number): string {
  if (pct >= 65) return "text-emerald-300";
  if (pct >= 50) return "text-neutral-200";
  if (pct > 0) return "text-red-300";
  return "text-neutral-600";
}

export function hitBgClass(pct: number): string {
  if (pct >= 65) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (pct >= 50) return "bg-white/[0.04] text-neutral-200 border-white/[0.08]";
  if (pct > 0) return "bg-red-500/10 text-red-300 border-red-500/20";
  return "bg-transparent text-neutral-600 border-transparent";
}
