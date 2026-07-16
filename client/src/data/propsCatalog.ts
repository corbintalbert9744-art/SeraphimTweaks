/** Live prop catalog — populated from backend caches only (no mock seed). */

import type { LeagueCode } from "@/data/mock";
import type { ResearchCheck } from "@/data/mock";
import { getCachedNbaPropDetail } from "@/lib/nbaLiveCache";

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
  kind?: "sportsbook" | "pickem";
  slug?: string;
  isMock?: boolean;
  edgeVsProjection?: number;
  isBestValue?: boolean;
  projectedValue?: number;
  modelSide?: "Over" | "Under";
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
  side: "Over" | "Under";
  line: number;
  americanOdds: number;
  noVigProb: number;
  noVigOpposite: number;
  evPercent: number;
  confidence: number;
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
  projectedValue?: number;
  recommendation?: "Over" | "Under";
  edgeVsLine?: number | null;
  overProbability?: number;
  underProbability?: number;
  bestValueBook?: string;
  linesAreMock?: boolean;
  homeAway?: {
    home: { samples: number; average: number | null; rate?: number | null };
    away: { samples: number; average: number | null; rate?: number | null };
  };
  minutesTrend?: Array<{
    date: string;
    minutes: number;
    value: number | null;
    opponent: string;
    home: boolean;
  }>;
  projectedMinutes?: number;
  usageRate?: number;
  opponentHistory?: {
    opponent: string;
    meetings: number;
    average: number | null;
    recent: Array<{ date: string; value: number | null; minutes?: number | null; home: boolean }>;
  };
  injuryImpact?: {
    status: string;
    detail: string;
    affectsProjection: boolean;
  };
  hitRates?: {
    l5?: string;
    l10?: string;
    l20?: string;
    season?: string;
    homeRate?: number | null;
    awayRate?: number | null;
    streak?: number | null;
    restDays?: number | null;
  };
}

const catalog: Record<string, PropDetail> = {};

export function getPropDetail(id: string): PropDetail | undefined {
  return catalog[id] ?? getCachedNbaPropDetail(id);
}

export function getPropsForPlayer(playerId: string): PropDetail[] {
  return Object.values(catalog).filter((p) => p.playerId === playerId);
}

export function listPropDetails(): PropDetail[] {
  const cached = Object.values(catalog);
  return cached.sort((a, b) => b.researchScore - a.researchScore);
}

export function registerPropDetails(props: PropDetail[]) {
  for (const p of props) catalog[p.id] = p;
}

export function clearPropCatalog() {
  for (const key of Object.keys(catalog)) delete catalog[key];
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function bestBookForSide(prop: PropDetail, side: "Over" | "Under"): BookQuote {
  if (!prop.books.length) {
    return { book: "Consensus", line: prop.line, over: prop.americanOdds, under: -110 };
  }
  return prop.books.reduce((best, book) => {
    const bestOdds = side === "Over" ? best.over : best.under;
    const nextOdds = side === "Over" ? book.over : book.under;
    const bestVal = bestOdds < 0 ? 10000 / Math.abs(bestOdds) : bestOdds;
    const nextVal = nextOdds < 0 ? 10000 / Math.abs(nextOdds) : nextOdds;
    return nextVal > bestVal ? book : best;
  });
}
