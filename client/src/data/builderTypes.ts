import type { LeagueCode } from "@/data/mock";

export interface LegGameSample {
  opponent: string;
  /** e.g. @SAC or POR */
  label: string;
  value: number;
  hit: boolean;
}

/** Shared shape for Parlay Builder legs across leagues. */
export interface BuilderLeg {
  id: string;
  league: LeagueCode;
  playerId: string;
  player: string;
  /** Short display name e.g. "S. Curry" */
  shortName: string;
  initials: string;
  team: string;
  opponent: string;
  position: string;
  market: string;
  /** Short market code e.g. PTS, 3PM */
  marketCode: string;
  side: "Over" | "Under";
  line: number;
  americanOdds: number;
  noVigProb: number;
  evPercent: number;
  confidence: number;
  tipTime: string;
  eventKey: string;
  /** Raw L10 string e.g. "8/10" */
  l10: string;
  /** Hit rate percent for current side at line (0–100) */
  l10Pct: number;
  /** Last 10 game samples vs the line */
  last10: LegGameSample[];
}
