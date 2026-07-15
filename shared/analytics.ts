/** Pure analytics helpers — no I/O. Shared by API + future workers. */

export function americanToImplied(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

export function noVigPair(overAmerican: number, underAmerican: number): {
  over: number;
  under: number;
} {
  const o = americanToImplied(overAmerican);
  const u = americanToImplied(underAmerican);
  const sum = o + u || 1;
  return { over: o / sum, under: u / sum };
}

export function expectedValue(prob: number, american: number): number {
  const stake = 100;
  const profit = american > 0 ? (american / 100) * stake : (100 / Math.abs(american)) * stake;
  return ((prob * profit - (1 - prob) * stake) / stake) * 100;
}

export type HitWindow = { hits: number; samples: number; rate: number; label: string };

export function hitRate(values: number[], line: number, side: "Over" | "Under", n: number): HitWindow {
  const slice = values.slice(0, n);
  const samples = slice.length;
  const hits = slice.filter((v) => (side === "Over" ? v > line : v < line)).length;
  return {
    hits,
    samples,
    rate: samples ? hits / samples : 0,
    label: samples ? `${hits}/${samples}` : "0/0",
  };
}

export type ResearchCheck = {
  code: string;
  status: "pass" | "warn" | "fail" | "unknown";
  label: string;
};

export function researchScoreFromChecks(checks: ResearchCheck[]): number {
  const pts = checks.reduce((sum, c) => {
    if (c.status === "pass") return sum + 16;
    if (c.status === "warn") return sum + 8;
    if (c.status === "unknown") return sum + 6;
    return sum;
  }, 0);
  return Math.min(99, Math.max(35, pts));
}

export function buildResearchChecks(input: {
  l10: HitWindow;
  l5: HitWindow;
  injuryStatus?: string;
  booksAgree?: boolean;
  lineMovedFavorably?: boolean;
  minutesOk?: boolean;
}): ResearchCheck[] {
  const inj = (input.injuryStatus ?? "None").toLowerCase();
  return [
    {
      code: "L10",
      status: input.l10.rate >= 0.7 ? "pass" : input.l10.rate >= 0.5 ? "warn" : "fail",
      label: `L10: ${input.l10.label}`,
    },
    {
      code: "L5",
      status: input.l5.rate >= 0.6 ? "pass" : "warn",
      label: `L5: ${input.l5.label}`,
    },
    {
      code: "BOOKS",
      status: input.booksAgree === false ? "warn" : "pass",
      label: input.booksAgree === false ? "Mild book split" : "Books clustered",
    },
    {
      code: "MOVE",
      status: input.lineMovedFavorably ? "pass" : "unknown",
      label: input.lineMovedFavorably ? "Line moved in favor" : "Line movement pending",
    },
    {
      code: "MIN",
      status: input.minutesOk === false ? "warn" : "pass",
      label: input.minutesOk === false ? "Minutes uncertainty" : "Workload projection OK",
    },
    {
      code: "INJ",
      status: inj === "none" || inj === "healthy" || inj === "active" ? "pass" : "warn",
      label: inj === "none" || inj === "healthy" || inj === "active" ? "No injury concerns" : `Injury: ${input.injuryStatus}`,
    },
  ];
}

/** Model confidence — form + sample size + edge, separate from Research Score. */
export function confidenceScore(input: {
  l10Rate: number;
  samples: number;
  evPercent: number;
  injuryPenalty?: number;
}): number {
  const form = input.l10Rate * 55;
  const sample = Math.min(20, input.samples) * 1.2;
  const edge = Math.min(15, Math.max(0, input.evPercent) * 1.5);
  const pen = input.injuryPenalty ?? 0;
  return Math.round(Math.min(98, Math.max(40, form + sample + edge - pen)));
}

export function dataQualityScore(input: {
  hasGamelog: boolean;
  gamelogCount: number;
  hasInjuryFeed: boolean;
  hasLiveOdds: boolean;
  freshnessMinutes: number;
}): number {
  let score = 40;
  if (input.hasGamelog) score += 20;
  score += Math.min(20, input.gamelogCount);
  if (input.hasInjuryFeed) score += 8;
  if (input.hasLiveOdds) score += 12;
  else score -= 6;
  if (input.freshnessMinutes <= 30) score += 10;
  else if (input.freshnessMinutes <= 120) score += 5;
  return Math.min(98, Math.max(30, score));
}

export function explainProp(input: {
  player: string;
  market: string;
  side: "Over" | "Under";
  line: number;
  l5: HitWindow;
  l10: HitWindow;
  l20: HitWindow;
  noVig: number;
  evPercent: number;
  researchScore: number;
  matchupNote?: string;
}): string[] {
  return [
    `${input.player} ${input.side.toLowerCase()} ${input.line} ${input.market}: L10 ${input.l10.label} (${Math.round(input.l10.rate * 100)}%), L5 ${input.l5.label}.`,
    `No-vig fair probability ${(input.noVig * 100).toFixed(1)}% · model EV ${input.evPercent >= 0 ? "+" : ""}${input.evPercent.toFixed(1)}%.`,
    `Research Score ${input.researchScore}/100 is checklist-backed (form, books, injury, workload) — not a win guarantee.`,
    input.matchupNote ?? "Matchup context will enrich as defensive rankings land in the warehouse.",
  ];
}
