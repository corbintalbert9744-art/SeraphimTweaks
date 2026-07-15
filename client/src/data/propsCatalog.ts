import type { LeagueCode } from "@/data/mock";
import type { ResearchCheck } from "@/data/mock";
import { mockNbaProps } from "@/data/nbaMock";
import { mockNflProps } from "@/data/nflMock";

export interface LinePoint {
  label: string;
  line: number;
  odds: number;
}

export interface BookQuote {
  book: string;
  line: number;
  over: number;
  under: number;
}

export interface OpponentDefense {
  rank: number;
  of: number;
  label: string;
  note: string;
}

export interface PropDetail {
  id: string;
  league: LeagueCode;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  position: string;
  market: string;
  /** Consensus / model recommended side */
  side: "Over" | "Under";
  line: number;
  americanOdds: number;
  noVigProb: number;
  /** Implied no-vig on the opposite side (sums ~1 with noVigProb) */
  noVigOpposite: number;
  evPercent: number;
  /** Model confidence 0–100 (separate from Research Score) */
  confidence: number;
  /** Checklist-backed Research Score 0–100 */
  researchScore: number;
  dqs: number;
  l5: string;
  l10: string;
  l20: string;
  season: string;
  tipTime: string;
  why: string;
  checks: ResearchCheck[];
  books: BookQuote[];
  movement: LinePoint[];
  analysis: string[];
  opponentDefense: OpponentDefense;
  similarPropIds: string[];
}

function scoreFromChecks(checks: ResearchCheck[]): number {
  const pts = checks.reduce((sum, c) => {
    if (c.status === "pass") return sum + 16;
    if (c.status === "warn") return sum + 8;
    if (c.status === "unknown") return sum + 6;
    return sum;
  }, 0);
  return Math.min(99, Math.max(40, pts));
}

function oppositeOdds(odds: number): number {
  if (odds <= -100) return Math.round(Math.abs(odds) * 0.92);
  if (odds >= 100) return -Math.round(odds * 0.92);
  return -110;
}

function nbaDetails(): PropDetail[] {
  const rows = mockNbaProps.map((p) => {
    const baseChecks: ResearchCheck[] = [
      { code: "L10", status: p.l10.startsWith("9") || p.l10.startsWith("8") ? "pass" : "warn", label: `L10: ${p.l10}` },
      { code: "MATCHUP", status: "pass", label: `Matchup lean vs ${p.opponent}` },
      { code: "BOOKS", status: p.confidence >= 80 ? "pass" : "warn", label: p.confidence >= 80 ? "Sharp books agree" : "Mild book split" },
      { code: "MOVE", status: "pass", label: "Line tracked since open" },
      { code: "MIN", status: "pass", label: `Projected ${p.projectedMinutes} minutes` },
      {
        code: "INJ",
        status: p.injury === "None" ? "pass" : "warn",
        label: p.injury === "None" ? "No injury concerns" : `Injury: ${p.injury}`,
      },
    ];
    const researchScore = scoreFromChecks(baseChecks);
    const overOdds = p.side === "Over" ? p.americanOdds : oppositeOdds(p.americanOdds);
    const underOdds = p.side === "Under" ? p.americanOdds : oppositeOdds(p.americanOdds);
    return {
      id: p.id,
      league: "NBA" as const,
      playerId: p.playerId,
      player: p.player,
      team: p.team,
      opponent: p.opponent,
      position: p.position,
      market: p.market,
      side: p.side,
      line: p.line,
      americanOdds: p.americanOdds,
      noVigProb: p.noVigProb,
      noVigOpposite: Math.max(0.01, 1 - p.noVigProb),
      evPercent: p.evPercent,
      confidence: p.confidence,
      researchScore,
      dqs: Math.min(98, p.confidence - 2 + (p.injury === "None" ? 4 : 0)),
      l5: p.l5,
      l10: p.l10,
      l20: p.l20,
      season: p.season,
      tipTime: p.tipTime,
      why: `${p.side} ${p.line} ${p.market} — Research Score ${researchScore}/100`,
      checks: baseChecks,
      books: [
        { book: "DraftKings", line: p.line, over: overOdds, under: underOdds },
        { book: "FanDuel", line: p.line, over: overOdds + 2, under: underOdds - 2 },
        { book: "BetMGM", line: p.line + (p.side === "Over" ? 0.5 : -0.5), over: overOdds - 4, under: underOdds + 4 },
        { book: "Caesars", line: p.line, over: overOdds + 5, under: underOdds - 3 },
      ],
      movement: [
        { label: "Open", line: p.line - 1, odds: p.americanOdds - 5 },
        { label: "AM", line: p.line - 0.5, odds: p.americanOdds - 2 },
        { label: "Noon", line: p.line, odds: p.americanOdds },
        { label: "Now", line: p.line, odds: p.americanOdds },
      ],
      analysis: [
        `No-vig fair probability sits at ${(p.noVigProb * 100).toFixed(1)}% on the offered price.`,
        `Hit rates: L5 ${p.l5}, L10 ${p.l10}, L20 ${p.l20}, Season ${p.season}.`,
        `${p.team} vs ${p.opponent} · ${p.tipTime} · proj ${p.projectedMinutes} min.`,
      ],
      opponentDefense: {
        rank: p.confidence >= 85 ? 24 : 16,
        of: 30,
        label: `vs ${p.position} ${p.market.toLowerCase()}`,
        note: `${p.opponent} defense sits mid-to-soft vs ${p.position} ${p.market.toLowerCase()} in recent samples.`,
      },
      similarPropIds: [] as string[],
    };
  });
  for (const row of rows) {
    row.similarPropIds = rows.filter((r) => r.id !== row.id && r.playerId === row.playerId).map((r) => r.id).slice(0, 3);
    if (row.similarPropIds.length === 0) {
      row.similarPropIds = rows.filter((r) => r.id !== row.id && r.league === row.league).map((r) => r.id).slice(0, 3);
    }
  }
  return rows;
}

function nflDetails(): PropDetail[] {
  const rows = mockNflProps.map((p) => {
    const baseChecks: ResearchCheck[] = [
      { code: "L10", status: parseInt(p.l10) >= 7 ? "pass" : "warn", label: `L10: ${p.l10}` },
      { code: "MATCHUP", status: "pass", label: `Matchup lean vs ${p.opponent}` },
      { code: "BOOKS", status: p.confidence >= 80 ? "pass" : "warn", label: p.confidence >= 80 ? "Sharp books agree" : "Mild book split" },
      { code: "MOVE", status: "pass", label: "Line tracked since open" },
      { code: "MIN", status: "pass", label: `Snap proj ${p.projectedSnapPct}%` },
      {
        code: "INJ",
        status: p.injury === "None" ? "pass" : "warn",
        label: p.injury === "None" ? "No injury concerns" : `Injury: ${p.injury}`,
      },
    ];
    const researchScore = scoreFromChecks(baseChecks);
    const overOdds = p.side === "Over" ? p.americanOdds : oppositeOdds(p.americanOdds);
    const underOdds = p.side === "Under" ? p.americanOdds : oppositeOdds(p.americanOdds);
    const yardMove = p.market.includes("Yard") ? 4 : 0.5;
    return {
      id: p.id,
      league: "NFL" as const,
      playerId: p.playerId,
      player: p.player,
      team: p.team,
      opponent: p.opponent,
      position: p.position,
      market: p.market,
      side: p.side,
      line: p.line,
      americanOdds: p.americanOdds,
      noVigProb: p.noVigProb,
      noVigOpposite: Math.max(0.01, 1 - p.noVigProb),
      evPercent: p.evPercent,
      confidence: p.confidence,
      researchScore,
      dqs: Math.min(98, p.confidence - 1 + (p.injury === "None" ? 3 : -4)),
      l5: p.l5,
      l10: p.l10,
      l20: p.l20,
      season: p.season,
      tipTime: p.tipTime,
      why: `${p.market} ${p.side} ${p.line} — Research Score ${researchScore}/100`,
      checks: baseChecks,
      books: [
        { book: "DraftKings", line: p.line, over: overOdds, under: underOdds },
        { book: "FanDuel", line: p.line, over: overOdds + 3, under: underOdds - 2 },
        { book: "BetMGM", line: p.line, over: overOdds - 2, under: underOdds + 3 },
        { book: "Caesars", line: p.line + yardMove / 2, over: overOdds + 6, under: underOdds - 4 },
      ],
      movement: [
        { label: "Open", line: p.line - yardMove, odds: p.americanOdds - 6 },
        { label: "Wed", line: p.line - yardMove / 2, odds: p.americanOdds - 2 },
        { label: "Sat", line: p.line, odds: p.americanOdds },
        { label: "Now", line: p.line, odds: p.americanOdds },
      ],
      analysis: [
        `No-vig fair probability ${(p.noVigProb * 100).toFixed(1)}% at ${p.americanOdds > 0 ? "+" : ""}${p.americanOdds}.`,
        `Form windows: L5 ${p.l5} · L10 ${p.l10} · L20 ${p.l20} · Season ${p.season}.`,
        `Week matchup ${p.team} vs ${p.opponent} · ${p.tipTime}.`,
      ],
      opponentDefense: {
        rank: p.confidence >= 82 ? 26 : 18,
        of: 32,
        label: `vs ${p.position} ${p.market.toLowerCase()}`,
        note: `${p.opponent} ranks soft-to-average vs ${p.position} ${p.market.toLowerCase()} this season.`,
      },
      similarPropIds: [] as string[],
    };
  });
  for (const row of rows) {
    row.similarPropIds = rows.filter((r) => r.id !== row.id && r.playerId === row.playerId).map((r) => r.id).slice(0, 3);
    if (row.similarPropIds.length === 0) {
      row.similarPropIds = rows.filter((r) => r.id !== row.id).map((r) => r.id).slice(0, 3);
    }
  }
  return rows;
}

const catalog: Record<string, PropDetail> = Object.fromEntries(
  [...nbaDetails(), ...nflDetails()].map((p) => [p.id, p]),
);

export function getPropDetail(id: string): PropDetail | undefined {
  return catalog[id];
}

export function getPropsForPlayer(playerId: string): PropDetail[] {
  return Object.values(catalog).filter((p) => p.playerId === playerId);
}

export function listPropDetails(): PropDetail[] {
  return Object.values(catalog).sort((a, b) => b.researchScore - a.researchScore);
}

export function registerPropDetails(props: PropDetail[]) {
  for (const p of props) catalog[p.id] = p;
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function bestBookForSide(prop: PropDetail, side: "Over" | "Under"): BookQuote {
  return prop.books.reduce((best, book) => {
    const bestOdds = side === "Over" ? best.over : best.under;
    const nextOdds = side === "Over" ? book.over : book.under;
    // Prefer higher American odds (better price)
    const bestVal = bestOdds < 0 ? 10000 / Math.abs(bestOdds) : bestOdds;
    const nextVal = nextOdds < 0 ? 10000 / Math.abs(nextOdds) : nextOdds;
    return nextVal > bestVal ? book : best;
  });
}
