import type { BuilderLeg } from "@/data/builderTypes";
import type { PropDetail } from "@/data/propsCatalog";
import type { ResearchCheck } from "@/data/mock";
import { withLegHitData } from "@/lib/legStats";

export type WnbaMarket = "Points" | "Rebounds" | "Assists" | "Threes" | "PRA";

export interface WnbaProp {
  id: string;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  position: string;
  market: WnbaMarket;
  side: "Over" | "Under";
  line: number;
  americanOdds: number;
  noVigProb: number;
  evPercent: number;
  confidence: number;
  l5: string;
  l10: string;
  l20: string;
  season: string;
  tipTime: string;
  projectedMinutes: number;
  injury: "None" | "Probable" | "Questionable";
}

export interface WnbaPlayerCard {
  id: string;
  name: string;
  team: string;
  opponent: string;
  position: string;
  initials: string;
  projectedMinutes: number;
  seasonAvg: { pts: number; reb: number; ast: number };
  topPropId: string;
  confidence: number;
  matchupNote: string;
}

export const wnbaMarketOptions: Array<WnbaMarket | "All"> = [
  "All",
  "Points",
  "Rebounds",
  "Assists",
  "Threes",
  "PRA",
];

export const wnbaTeamOptions = ["All", "IND", "LAS", "NYL", "MIN", "SEA", "PHX", "CHI", "ATL"] as const;

export const mockWnbaProps: WnbaProp[] = [
  {
    id: "wnba-clark-ast",
    playerId: "clark",
    player: "Caitlin Clark",
    team: "IND",
    opponent: "CON",
    position: "G",
    market: "Assists",
    side: "Over",
    line: 8.5,
    americanOdds: 105,
    noVigProb: 0.487,
    evPercent: 4.9,
    confidence: 88,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "22/30",
    tipTime: "7:00 PM ET",
    projectedMinutes: 34,
    injury: "None",
  },
  {
    id: "wnba-wilson-pts",
    playerId: "wilson",
    player: "A'ja Wilson",
    team: "LAS",
    opponent: "SEA",
    position: "F",
    market: "Points",
    side: "Over",
    line: 26.5,
    americanOdds: -110,
    noVigProb: 0.536,
    evPercent: 4.0,
    confidence: 90,
    l5: "5/5",
    l10: "9/10",
    l20: "16/20",
    season: "24/28",
    tipTime: "10:00 PM ET",
    projectedMinutes: 33,
    injury: "None",
  },
  {
    id: "wnba-stewart-reb",
    playerId: "stewart",
    player: "Breanna Stewart",
    team: "NYL",
    opponent: "CHI",
    position: "F",
    market: "Rebounds",
    side: "Over",
    line: 8.5,
    americanOdds: -115,
    noVigProb: 0.548,
    evPercent: 3.3,
    confidence: 83,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "19/27",
    tipTime: "7:30 PM ET",
    projectedMinutes: 34,
    injury: "None",
  },
  {
    id: "wnba-collier-pra",
    playerId: "collier",
    player: "Napheesa Collier",
    team: "MIN",
    opponent: "PHX",
    position: "F",
    market: "PRA",
    side: "Over",
    line: 34.5,
    americanOdds: -108,
    noVigProb: 0.53,
    evPercent: 3.7,
    confidence: 85,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "20/26",
    tipTime: "8:00 PM ET",
    projectedMinutes: 35,
    injury: "None",
  },
  {
    id: "wnba-loyd-3pm",
    playerId: "loyd",
    player: "Jewell Loyd",
    team: "SEA",
    opponent: "LAS",
    position: "G",
    market: "Threes",
    side: "Over",
    line: 2.5,
    americanOdds: -120,
    noVigProb: 0.555,
    evPercent: 2.5,
    confidence: 76,
    l5: "3/5",
    l10: "6/10",
    l20: "12/20",
    season: "16/27",
    tipTime: "10:00 PM ET",
    projectedMinutes: 32,
    injury: "Probable",
  },
  {
    id: "wnba-copper-pts",
    playerId: "copper",
    player: "Kahleah Copper",
    team: "PHX",
    opponent: "MIN",
    position: "G",
    market: "Points",
    side: "Over",
    line: 18.5,
    americanOdds: -105,
    noVigProb: 0.522,
    evPercent: 3.1,
    confidence: 80,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "18/26",
    tipTime: "8:00 PM ET",
    projectedMinutes: 31,
    injury: "None",
  },
  {
    id: "wnba-clark-pts",
    playerId: "clark",
    player: "Caitlin Clark",
    team: "IND",
    opponent: "CON",
    position: "G",
    market: "Points",
    side: "Over",
    line: 19.5,
    americanOdds: -112,
    noVigProb: 0.541,
    evPercent: 3.5,
    confidence: 84,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "21/30",
    tipTime: "7:00 PM ET",
    projectedMinutes: 34,
    injury: "None",
  },
  {
    id: "wnba-wilson-reb",
    playerId: "wilson",
    player: "A'ja Wilson",
    team: "LAS",
    opponent: "SEA",
    position: "F",
    market: "Rebounds",
    side: "Over",
    line: 10.5,
    americanOdds: -118,
    noVigProb: 0.552,
    evPercent: 2.8,
    confidence: 87,
    l5: "4/5",
    l10: "8/10",
    l20: "15/20",
    season: "23/28",
    tipTime: "10:00 PM ET",
    projectedMinutes: 33,
    injury: "None",
  },
];

export const mockWnbaPlayerCards: WnbaPlayerCard[] = [
  {
    id: "wilson",
    name: "A'ja Wilson",
    team: "LAS",
    opponent: "SEA",
    position: "F",
    initials: "AW",
    projectedMinutes: 33,
    seasonAvg: { pts: 27.2, reb: 11.1, ast: 2.8 },
    topPropId: "wnba-wilson-pts",
    confidence: 90,
    matchupNote: "SEA ranks 25th in paint scoring defense L8.",
  },
  {
    id: "clark",
    name: "Caitlin Clark",
    team: "IND",
    opponent: "CON",
    position: "G",
    initials: "CC",
    projectedMinutes: 34,
    seasonAvg: { pts: 19.8, reb: 5.6, ast: 8.9 },
    topPropId: "wnba-clark-ast",
    confidence: 88,
    matchupNote: "CON allows 26.1 AST/g — soft vs primary creators.",
  },
  {
    id: "collier",
    name: "Napheesa Collier",
    team: "MIN",
    opponent: "PHX",
    position: "F",
    initials: "NC",
    projectedMinutes: 35,
    seasonAvg: { pts: 22.4, reb: 9.3, ast: 3.6 },
    topPropId: "wnba-collier-pra",
    confidence: 85,
    matchupNote: "PHX mid-pack vs forwards; PRA floor travels.",
  },
  {
    id: "stewart",
    name: "Breanna Stewart",
    team: "NYL",
    opponent: "CHI",
    position: "F",
    initials: "BS",
    projectedMinutes: 34,
    seasonAvg: { pts: 20.6, reb: 8.4, ast: 3.9 },
    topPropId: "wnba-stewart-reb",
    confidence: 83,
    matchupNote: "CHI allows second-chance volume on the glass.",
  },
];

export function wnbaToBuilderLeg(prop: WnbaProp): BuilderLeg {
  return withLegHitData({
    id: prop.id,
    league: "WNBA",
    playerId: prop.playerId,
    player: prop.player,
    team: prop.team,
    opponent: prop.opponent,
    position: prop.position,
    market: prop.market,
    side: prop.side,
    line: prop.line,
    americanOdds: prop.americanOdds,
    noVigProb: prop.noVigProb,
    evPercent: prop.evPercent,
    confidence: prop.confidence,
    tipTime: prop.tipTime,
    eventKey: `${prop.team}-${prop.opponent}-${prop.tipTime}`,
    l10: prop.l10,
  });
}

export function wnbaToPropDetails(props: WnbaProp[]): PropDetail[] {
  const rows = props.map((p) => {
    const checks: ResearchCheck[] = [
      { code: "L10", status: parseInt(p.l10) >= 7 ? "pass" : "warn", label: `L10: ${p.l10}` },
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
    const researchScore = Math.min(
      99,
      checks.reduce((s, c) => s + (c.status === "pass" ? 16 : c.status === "warn" ? 8 : 6), 0),
    );
    const over = p.side === "Over" ? p.americanOdds : p.americanOdds > 0 ? -Math.round(p.americanOdds * 0.9) : Math.round(Math.abs(p.americanOdds) * 0.9);
    const under = p.side === "Under" ? p.americanOdds : p.americanOdds > 0 ? -Math.round(p.americanOdds * 0.9) : Math.round(Math.abs(p.americanOdds) * 0.9);
    return {
      id: p.id,
      league: "WNBA" as const,
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
      dqs: Math.min(97, p.confidence + (p.injury === "None" ? 3 : -2)),
      l5: p.l5,
      l10: p.l10,
      l20: p.l20,
      season: p.season,
      tipTime: p.tipTime,
      why: `${p.side} ${p.line} ${p.market} — Research Score ${researchScore}/100`,
      checks,
      books: [
        { book: "DraftKings", line: p.line, over, under },
        { book: "FanDuel", line: p.line, over: over + 3, under: under - 2 },
        { book: "BetMGM", line: p.line, over: over - 2, under: under + 3 },
      ],
      movement: [
        { label: "Open", line: p.line - 0.5, odds: p.americanOdds - 5 },
        { label: "AM", line: p.line, odds: p.americanOdds - 2 },
        { label: "Now", line: p.line, odds: p.americanOdds },
      ],
      analysis: [
        `No-vig ${(p.noVigProb * 100).toFixed(1)}% at offered price.`,
        `Hit rates L5 ${p.l5} · L10 ${p.l10} · Season ${p.season}.`,
        `${p.team} vs ${p.opponent} · proj ${p.projectedMinutes} min.`,
      ],
      opponentDefense: {
        rank: p.confidence >= 82 ? 10 : 6,
        of: 12,
        label: `vs ${p.position} ${p.market.toLowerCase()}`,
        note: `${p.opponent} defense vs ${p.position} ${p.market.toLowerCase()} in recent WNBA samples.`,
      },
      similarPropIds: [] as string[],
    };
  });
  for (const row of rows) {
    row.similarPropIds = rows
      .filter((r) => r.id !== row.id && (r.playerId === row.playerId || r.league === row.league))
      .map((r) => r.id)
      .slice(0, 3);
  }
  return rows;
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function parseHitRate(value: string): number {
  const [hits, samples] = value.split("/").map(Number);
  if (!samples) return 0;
  return hits / samples;
}
