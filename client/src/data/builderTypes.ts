import type { LeagueCode } from "@/data/mock";

/** Shared shape for Parlay Builder legs across leagues. */
export interface BuilderLeg {
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
  evPercent: number;
  confidence: number;
  tipTime: string;
  eventKey: string;
}
