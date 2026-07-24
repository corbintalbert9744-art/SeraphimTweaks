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

/** Aligned with data-platform `app.analytics.plus_ev`. */
export const PLUS_EV_THRESHOLD = 4;
export const STRONG_PLUS_EV_THRESHOLD = 12;

export function isPlusEv(evPercent: number | null | undefined, modelEdge?: number | null): boolean {
  if (evPercent == null || !Number.isFinite(evPercent)) return false;
  if (evPercent < PLUS_EV_THRESHOLD) return false;
  if (modelEdge != null && Number.isFinite(modelEdge) && modelEdge <= 0) return false;
  return true;
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

export type WhyPillar = {
  id: "research" | "novig" | "matchup" | "form" | "movement";
  title: string;
  status: "strong" | "solid" | "watch";
  summary: string;
  detail: string;
};

/** Structured “why this is Prop of the Day” — Seraphim differentiator vs raw odds boards. */
export function buildPropOfTheDayWhy(input: {
  researchScore: number;
  checks: ResearchCheck[];
  noVig: number;
  evPercent: number;
  l5: HitWindow;
  l10: HitWindow;
  l20: HitWindow;
  side: "Over" | "Under";
  line: number;
  market: string;
  matchup: string;
  openLine: number;
  currentLine: number;
  injuryStatus?: string;
}): { headline: string; verdict: "strong" | "solid" | "watch"; pillars: WhyPillar[] } {
  const formPct = Math.round(input.l10.rate * 100);
  const moved = input.currentLine - input.openLine;
  const movedFavor =
    (input.side === "Over" && moved < 0) || (input.side === "Under" && moved > 0);

  const pillars: WhyPillar[] = [
    {
      id: "research",
      title: "Research Score",
      status: input.researchScore >= 85 ? "strong" : input.researchScore >= 70 ? "solid" : "watch",
      summary: `${input.researchScore}/100 checklist`,
      detail: `${input.checks.filter((c) => c.status === "pass").length}/${input.checks.length} gates passed — not a win probability.`,
    },
    {
      id: "novig",
      title: "No-vig edge",
      status: input.evPercent >= 4 ? "strong" : input.evPercent >= 1.5 ? "solid" : "watch",
      summary: `${(input.noVig * 100).toFixed(1)}% fair · EV ${input.evPercent >= 0 ? "+" : ""}${input.evPercent.toFixed(1)}%`,
      detail: "Juice removed across the two-way; EV is vs the offered price, not a guarantee.",
    },
    {
      id: "matchup",
      title: "Matchup",
      status: (input.injuryStatus ?? "None").toLowerCase() === "none" ? "solid" : "watch",
      summary: input.matchup,
      detail:
        (input.injuryStatus ?? "None").toLowerCase() === "none"
          ? "No active injury flag on the featured player from the ESPN feed."
          : `Injury context: ${input.injuryStatus}`,
    },
    {
      id: "form",
      title: "Recent form",
      status: formPct >= 70 ? "strong" : formPct >= 50 ? "solid" : "watch",
      summary: `L10 ${input.l10.label} (${formPct}%) · L5 ${input.l5.label}`,
      detail: `Cleared ${input.side.toLowerCase()} ${input.line} ${input.market.toLowerCase()} in ${input.l10.label} of the last ${input.l10.samples} tracked games (L20 ${input.l20.label}).`,
    },
    {
      id: "movement",
      title: "Line movement",
      status: movedFavor ? "strong" : Math.abs(moved) < 0.25 ? "solid" : "watch",
      summary:
        moved === 0
          ? `Stable at ${input.currentLine}`
          : `${input.openLine} → ${input.currentLine} (${moved > 0 ? "+" : ""}${moved})`,
      detail: movedFavor
        ? "Number moved toward value for the listed side."
        : Math.abs(moved) < 0.25
          ? "Little steam yet — edge is mostly form + research gates."
          : "Line drifted against the lean — size down or wait for a better number.",
    },
  ];

  const strongCount = pillars.filter((p) => p.status === "strong").length;
  const verdict: "strong" | "solid" | "watch" =
    strongCount >= 3 || (input.researchScore >= 85 && formPct >= 70)
      ? "strong"
      : strongCount >= 1 || input.researchScore >= 70
        ? "solid"
        : "watch";

  const headline =
    verdict === "strong"
      ? "Strongest play on the board — form, research gates, and edge align."
      : verdict === "solid"
        ? "Solid lean — enough signals to feature, still respect variance."
        : "Watchlist lean — featured for transparency, not max conviction.";

  return { headline, verdict, pillars };
}

/** Synthetic open→now path until live odds ticks land in the warehouse. */
export function synthesizeLinePath(openLine: number, currentLine: number): Array<{ t: string; line: number }> {
  const mid = Math.round(((openLine + currentLine) / 2) * 2) / 2;
  return [
    { t: "Open", line: openLine },
    { t: "AM", line: mid },
    { t: "Now", line: currentLine },
  ];
}

