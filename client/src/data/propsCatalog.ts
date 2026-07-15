import type { LeagueCode } from "@/data/mock";
import type { ResearchCheck } from "@/data/mock";
import { mockNbaProps } from "@/data/nbaMock";
import { mockNflProps } from "@/data/nflMock";

export interface LinePoint {
  label: string;
  line: number;
  odds: number;
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
  evPercent: number;
  confidence: number;
  dqs: number;
  l5: string;
  l10: string;
  l20: string;
  season: string;
  tipTime: string;
  why: string;
  checks: ResearchCheck[];
  books: Array<{ book: string; odds: number; line: number }>;
  movement: LinePoint[];
  analysis: string[];
}

function nbaDetails(): PropDetail[] {
  return mockNbaProps.map((p) => {
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
    return {
      id: p.id,
      league: "NBA",
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
      evPercent: p.evPercent,
      confidence: p.confidence,
      dqs: Math.min(98, p.confidence - 2 + (p.injury === "None" ? 4 : 0)),
      l5: p.l5,
      l10: p.l10,
      l20: p.l20,
      season: p.season,
      tipTime: p.tipTime,
      why: `${p.side} ${p.line} ${p.market} — research score ${p.confidence}/100`,
      checks: baseChecks,
      books: [
        { book: "Consensus", odds: p.americanOdds, line: p.line },
        { book: "Sharp A", odds: p.americanOdds + 2, line: p.line },
        { book: "Sharp B", odds: p.americanOdds - 3, line: p.line },
        { book: "Soft C", odds: p.americanOdds + 5, line: p.line },
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
    };
  });
}

function nflDetails(): PropDetail[] {
  return mockNflProps.map((p) => {
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
    return {
      id: p.id,
      league: "NFL",
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
      evPercent: p.evPercent,
      confidence: p.confidence,
      dqs: Math.min(98, p.confidence - 1 + (p.injury === "None" ? 3 : -4)),
      l5: p.l5,
      l10: p.l10,
      l20: p.l20,
      season: p.season,
      tipTime: p.tipTime,
      why: `${p.market} ${p.side} ${p.line} — research score ${p.confidence}/100`,
      checks: baseChecks,
      books: [
        { book: "Consensus", odds: p.americanOdds, line: p.line },
        { book: "Sharp A", odds: p.americanOdds + 3, line: p.line },
        { book: "Sharp B", odds: p.americanOdds - 2, line: p.line },
        { book: "Soft C", odds: p.americanOdds + 6, line: p.line },
      ],
      movement: [
        { label: "Open", line: p.line - (p.market.includes("Yard") ? 4 : 0.5), odds: p.americanOdds - 6 },
        { label: "Wed", line: p.line - (p.market.includes("Yard") ? 2 : 0), odds: p.americanOdds - 2 },
        { label: "Sat", line: p.line, odds: p.americanOdds },
        { label: "Now", line: p.line, odds: p.americanOdds },
      ],
      analysis: [
        `No-vig fair probability ${(p.noVigProb * 100).toFixed(1)}% at ${p.americanOdds > 0 ? "+" : ""}${p.americanOdds}.`,
        `Form windows: L5 ${p.l5} · L10 ${p.l10} · L20 ${p.l20} · Season ${p.season}.`,
        `Week matchup ${p.team} vs ${p.opponent} · ${p.tipTime}.`,
      ],
    };
  });
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

export function registerPropDetails(props: PropDetail[]) {
  for (const p of props) catalog[p.id] = p;
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}
