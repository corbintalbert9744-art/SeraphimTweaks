import type { BuilderLeg } from "@/data/builderTypes";
import type { PropDetail } from "@/data/propsCatalog";
import type { ResearchCheck } from "@/data/mock";
import { withLegHitData } from "@/lib/legStats";

export type MlbMarket = "Hits" | "RBIs" | "Strikeouts" | "Home Runs" | "Total Bases" | "Stolen Bases";

export interface MlbProp {
  id: string;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  position: string;
  market: MlbMarket;
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
  projectedInningsOrPa: number;
  injury: "None" | "Probable" | "Questionable";
}

export interface MlbPlayerCard {
  id: string;
  name: string;
  team: string;
  opponent: string;
  position: string;
  initials: string;
  seasonAvg: { hits: number; rbi: number; hr: number };
  topPropId: string;
  confidence: number;
  matchupNote: string;
}

export const mlbMarketOptions: Array<MlbMarket | "All"> = [
  "All",
  "Hits",
  "RBIs",
  "Strikeouts",
  "Home Runs",
  "Total Bases",
  "Stolen Bases",
];

export const mlbTeamOptions = [
  "All",
  "NYY",
  "LAD",
  "ATL",
  "HOU",
  "BOS",
  "PHI",
  "SD",
  "TEX",
  "SEA",
  "NYM",
] as const;

export const mockMlbProps: MlbProp[] = [
  {
    id: "mlb-judge-hr",
    playerId: "judge",
    player: "Aaron Judge",
    team: "NYY",
    opponent: "BOS",
    position: "OF",
    market: "Home Runs",
    side: "Over",
    line: 0.5,
    americanOdds: 210,
    noVigProb: 0.31,
    evPercent: 5.4,
    confidence: 86,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "28/90",
    tipTime: "7:05 PM ET",
    projectedInningsOrPa: 4.2,
    injury: "None",
  },
  {
    id: "mlb-ohtani-tb",
    playerId: "ohtani",
    player: "Shohei Ohtani",
    team: "LAD",
    opponent: "SD",
    position: "DH",
    market: "Total Bases",
    side: "Over",
    line: 1.5,
    americanOdds: -115,
    noVigProb: 0.545,
    evPercent: 4.8,
    confidence: 89,
    l5: "4/5",
    l10: "8/10",
    l20: "15/20",
    season: "62/88",
    tipTime: "10:10 PM ET",
    projectedInningsOrPa: 4.5,
    injury: "None",
  },
  {
    id: "mlb-soto-hits",
    playerId: "soto",
    player: "Juan Soto",
    team: "NYM",
    opponent: "PHI",
    position: "OF",
    market: "Hits",
    side: "Over",
    line: 0.5,
    americanOdds: -140,
    noVigProb: 0.59,
    evPercent: 3.9,
    confidence: 84,
    l5: "4/5",
    l10: "7/10",
    l20: "14/20",
    season: "71/92",
    tipTime: "7:10 PM ET",
    projectedInningsOrPa: 4.3,
    injury: "None",
  },
  {
    id: "mlb-acuna-sb",
    playerId: "acuna",
    player: "Ronald Acuña Jr.",
    team: "ATL",
    opponent: "NYM",
    position: "OF",
    market: "Stolen Bases",
    side: "Over",
    line: 0.5,
    americanOdds: 165,
    noVigProb: 0.36,
    evPercent: 5.1,
    confidence: 82,
    l5: "3/5",
    l10: "6/10",
    l20: "10/20",
    season: "38/85",
    tipTime: "7:20 PM ET",
    projectedInningsOrPa: 4.4,
    injury: "None",
  },
  {
    id: "mlb-skenes-k",
    playerId: "skenes",
    player: "Paul Skenes",
    team: "PIT",
    opponent: "CHC",
    position: "SP",
    market: "Strikeouts",
    side: "Over",
    line: 6.5,
    americanOdds: -105,
    noVigProb: 0.52,
    evPercent: 4.2,
    confidence: 88,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "18/24",
    tipTime: "6:40 PM ET",
    projectedInningsOrPa: 6.0,
    injury: "None",
  },
  {
    id: "mlb-betts-rbi",
    playerId: "betts",
    player: "Mookie Betts",
    team: "LAD",
    opponent: "SD",
    position: "SS",
    market: "RBIs",
    side: "Over",
    line: 0.5,
    americanOdds: 120,
    noVigProb: 0.44,
    evPercent: 3.6,
    confidence: 80,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "48/88",
    tipTime: "10:10 PM ET",
    projectedInningsOrPa: 4.4,
    injury: "None",
  },
  {
    id: "mlb-harper-hits",
    playerId: "harper",
    player: "Bryce Harper",
    team: "PHI",
    opponent: "NYM",
    position: "1B",
    market: "Hits",
    side: "Over",
    line: 0.5,
    americanOdds: -125,
    noVigProb: 0.56,
    evPercent: 3.3,
    confidence: 81,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "68/90",
    tipTime: "7:10 PM ET",
    projectedInningsOrPa: 4.2,
    injury: "None",
  },
  {
    id: "mlb-devers-tb",
    playerId: "devers",
    player: "Rafael Devers",
    team: "BOS",
    opponent: "NYY",
    position: "3B",
    market: "Total Bases",
    side: "Over",
    line: 1.5,
    americanOdds: 105,
    noVigProb: 0.47,
    evPercent: 4.0,
    confidence: 83,
    l5: "3/5",
    l10: "7/10",
    l20: "12/20",
    season: "55/89",
    tipTime: "7:05 PM ET",
    projectedInningsOrPa: 4.3,
    injury: "None",
  },
];

export const mockMlbPlayerCards: MlbPlayerCard[] = [
  {
    id: "judge",
    name: "Aaron Judge",
    team: "NYY",
    opponent: "BOS",
    position: "OF",
    initials: "AJ",
    seasonAvg: { hits: 1.1, rbi: 0.9, hr: 0.35 },
    topPropId: "mlb-judge-hr",
    confidence: 86,
    matchupNote: "Elevated HR/FB vs right-handed pitching in Fenway series spots.",
  },
  {
    id: "ohtani",
    name: "Shohei Ohtani",
    team: "LAD",
    opponent: "SD",
    position: "DH",
    initials: "SO",
    seasonAvg: { hits: 1.2, rbi: 1.0, hr: 0.4 },
    topPropId: "mlb-ohtani-tb",
    confidence: 89,
    matchupNote: "Total bases floor travels well against mid-rotation arms.",
  },
  {
    id: "soto",
    name: "Juan Soto",
    team: "NYM",
    opponent: "PHI",
    position: "OF",
    initials: "JS",
    seasonAvg: { hits: 1.05, rbi: 0.8, hr: 0.28 },
    topPropId: "mlb-soto-hits",
    confidence: 84,
    matchupNote: "Walk + contact profile supports Hits 0.5 in division play.",
  },
  {
    id: "skenes",
    name: "Paul Skenes",
    team: "PIT",
    opponent: "CHC",
    position: "SP",
    initials: "PS",
    seasonAvg: { hits: 0, rbi: 0, hr: 0 },
    topPropId: "mlb-skenes-k",
    confidence: 88,
    matchupNote: "K rate holds vs CHC lineup in recent samples.",
  },
];

export function mlbToBuilderLeg(prop: MlbProp): BuilderLeg {
  return withLegHitData({
    id: prop.id,
    league: "MLB",
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

export function mlbToPropDetails(props: MlbProp[]): PropDetail[] {
  const rows = props.map((p) => {
    const checks: ResearchCheck[] = [
      { code: "L10", status: parseInt(p.l10) >= 7 ? "pass" : "warn", label: `L10: ${p.l10}` },
      { code: "MATCHUP", status: "pass", label: `Matchup lean vs ${p.opponent}` },
      { code: "BOOKS", status: p.confidence >= 80 ? "pass" : "warn", label: p.confidence >= 80 ? "Sharp books agree" : "Mild book split" },
      { code: "MOVE", status: "pass", label: "Line tracked since open" },
      { code: "MIN", status: "pass", label: `PA/IP proj ${p.projectedInningsOrPa}` },
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
    const over =
      p.side === "Over"
        ? p.americanOdds
        : p.americanOdds > 0
          ? -Math.round(p.americanOdds * 0.9)
          : Math.round(Math.abs(p.americanOdds) * 0.9);
    const under =
      p.side === "Under"
        ? p.americanOdds
        : p.americanOdds > 0
          ? -Math.round(p.americanOdds * 0.9)
          : Math.round(Math.abs(p.americanOdds) * 0.9);
    return {
      id: p.id,
      league: "MLB" as const,
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
        { label: "Open", line: p.line, odds: p.americanOdds - 8 },
        { label: "AM", line: p.line, odds: p.americanOdds - 2 },
        { label: "Now", line: p.line, odds: p.americanOdds },
      ],
      analysis: [
        `No-vig ${(p.noVigProb * 100).toFixed(1)}% at offered price.`,
        `Hit rates L5 ${p.l5} · L10 ${p.l10} · Season ${p.season}.`,
        `${p.team} vs ${p.opponent} · proj ${p.projectedInningsOrPa} PA/IP.`,
      ],
      opponentDefense: {
        rank: p.confidence >= 85 ? 22 : 14,
        of: 30,
        label: `vs ${p.position} ${p.market.toLowerCase()}`,
        note: `${p.opponent} defense vs ${p.position} ${p.market.toLowerCase()} in recent MLB samples.`,
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
