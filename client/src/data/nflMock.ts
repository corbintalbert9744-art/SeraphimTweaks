export type NflMarket =
  | "Pass Yards"
  | "Rush Yards"
  | "Receiving Yards"
  | "Receptions"
  | "Pass TDs"
  | "Anytime TD"
  | "Completions";

export type NflSortKey =
  | "ev"
  | "confidence"
  | "noVig"
  | "l10"
  | "player"
  | "line";

export interface NflProp {
  id: string;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  position: string;
  market: NflMarket;
  side: "Over" | "Under";
  line: number;
  americanOdds: number;
  noVigProb: number;
  evPercent: number;
  confidence: number;
  projectedValue?: number;
  edgeVsLine?: number | null;
  edgePercent?: number | null;
  l5: string;
  l10: string;
  l20: string;
  season: string;
  tipTime: string;
  week: number;
  projectedSnapPct: number;
  injury: "None" | "Probable" | "Questionable" | "Doubtful";
}

export interface NflPlayerCard {
  id: string;
  name: string;
  team: string;
  opponent: string;
  position: string;
  headshotInitials: string;
  projectedSnapPct: number;
  seasonAvg: {
    passYds?: number;
    rushYds?: number;
    recYds?: number;
    receptions?: number;
  };
  topPropId: string;
  confidence: number;
  matchupNote: string;
}

export const nflMarketOptions: Array<NflMarket | "All"> = [
  "All",
  "Pass Yards",
  "Rush Yards",
  "Receiving Yards",
  "Receptions",
  "Pass TDs",
  "Anytime TD",
  "Completions",
];

export const nflTeamOptions = [
  "All",
  "KC",
  "BUF",
  "PHI",
  "SF",
  "DET",
  "BAL",
  "MIA",
  "DAL",
  "MIN",
  "CIN",
] as const;

export const mockNflProps: NflProp[] = [
  {
    id: "nfl-mahomes-pass",
    playerId: "mahomes",
    player: "Patrick Mahomes",
    team: "KC",
    opponent: "LV",
    position: "QB",
    market: "Pass Yards",
    side: "Over",
    line: 274.5,
    americanOdds: -110,
    noVigProb: 0.538,
    evPercent: 4.2,
    confidence: 87,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "9/14",
    tipTime: "Sun 4:25 PM ET",
    week: 12,
    projectedSnapPct: 100,
    injury: "None",
  },
  {
    id: "nfl-allen-pass",
    playerId: "allen",
    player: "Josh Allen",
    team: "BUF",
    opponent: "NYJ",
    position: "QB",
    market: "Pass Yards",
    side: "Over",
    line: 268.5,
    americanOdds: -108,
    noVigProb: 0.531,
    evPercent: 3.9,
    confidence: 84,
    l5: "4/5",
    l10: "7/10",
    l20: "12/20",
    season: "8/13",
    tipTime: "Sun 1:00 PM ET",
    week: 12,
    projectedSnapPct: 100,
    injury: "None",
  },
  {
    id: "nfl-hurts-rush",
    playerId: "hurts",
    player: "Jalen Hurts",
    team: "PHI",
    opponent: "WAS",
    position: "QB",
    market: "Rush Yards",
    side: "Over",
    line: 38.5,
    americanOdds: -115,
    noVigProb: 0.549,
    evPercent: 3.4,
    confidence: 82,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "10/13",
    tipTime: "Sun 1:00 PM ET",
    week: 12,
    projectedSnapPct: 100,
    injury: "None",
  },
  {
    id: "nfl-cmc-rush",
    playerId: "cmc",
    player: "Christian McCaffrey",
    team: "SF",
    opponent: "SEA",
    position: "RB",
    market: "Rush Yards",
    side: "Over",
    line: 72.5,
    americanOdds: -105,
    noVigProb: 0.52,
    evPercent: 2.8,
    confidence: 74,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "7/11",
    tipTime: "Sun 4:05 PM ET",
    week: 12,
    projectedSnapPct: 78,
    injury: "Questionable",
  },
  {
    id: "nfl-gibbs-rush",
    playerId: "gibbs",
    player: "Jahmyr Gibbs",
    team: "DET",
    opponent: "CHI",
    position: "RB",
    market: "Rush Yards",
    side: "Over",
    line: 68.5,
    americanOdds: -112,
    noVigProb: 0.542,
    evPercent: 3.6,
    confidence: 85,
    l5: "4/5",
    l10: "8/10",
    l20: "13/20",
    season: "9/13",
    tipTime: "Thu 8:15 PM ET",
    week: 12,
    projectedSnapPct: 62,
    injury: "None",
  },
  {
    id: "nfl-jefferson-rec",
    playerId: "jefferson",
    player: "Justin Jefferson",
    team: "MIN",
    opponent: "GB",
    position: "WR",
    market: "Receiving Yards",
    side: "Over",
    line: 84.5,
    americanOdds: -110,
    noVigProb: 0.536,
    evPercent: 4.0,
    confidence: 88,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "10/13",
    tipTime: "Sun 8:20 PM ET",
    week: 12,
    projectedSnapPct: 94,
    injury: "None",
  },
  {
    id: "nfl-hill-rec",
    playerId: "hill",
    player: "Tyreek Hill",
    team: "MIA",
    opponent: "NE",
    position: "WR",
    market: "Receiving Yards",
    side: "Over",
    line: 78.5,
    americanOdds: +100,
    noVigProb: 0.492,
    evPercent: 4.7,
    confidence: 79,
    l5: "3/5",
    l10: "7/10",
    l20: "12/20",
    season: "8/13",
    tipTime: "Sun 1:00 PM ET",
    week: 12,
    projectedSnapPct: 88,
    injury: "Probable",
  },
  {
    id: "nfl-lamb-rec",
    playerId: "lamb",
    player: "CeeDee Lamb",
    team: "DAL",
    opponent: "NYG",
    position: "WR",
    market: "Receptions",
    side: "Over",
    line: 6.5,
    americanOdds: -120,
    noVigProb: 0.561,
    evPercent: 2.5,
    confidence: 81,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "9/13",
    tipTime: "Sun 1:00 PM ET",
    week: 12,
    projectedSnapPct: 92,
    injury: "None",
  },
  {
    id: "nfl-kelce-rec",
    playerId: "kelce",
    player: "Travis Kelce",
    team: "KC",
    opponent: "LV",
    position: "TE",
    market: "Receiving Yards",
    side: "Over",
    line: 62.5,
    americanOdds: -108,
    noVigProb: 0.528,
    evPercent: 3.1,
    confidence: 80,
    l5: "3/5",
    l10: "7/10",
    l20: "12/20",
    season: "8/14",
    tipTime: "Sun 4:25 PM ET",
    week: 12,
    projectedSnapPct: 86,
    injury: "None",
  },
  {
    id: "nfl-jackson-pass",
    playerId: "jackson",
    player: "Lamar Jackson",
    team: "BAL",
    opponent: "CLE",
    position: "QB",
    market: "Pass TDs",
    side: "Over",
    line: 1.5,
    americanOdds: -105,
    noVigProb: 0.525,
    evPercent: 5.1,
    confidence: 76,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "7/12",
    tipTime: "Sun 1:00 PM ET",
    week: 12,
    projectedSnapPct: 100,
    injury: "None",
  },
  {
    id: "nfl-chase-atd",
    playerId: "chase",
    player: "Ja'Marr Chase",
    team: "CIN",
    opponent: "PIT",
    position: "WR",
    market: "Anytime TD",
    side: "Over",
    line: 0.5,
    americanOdds: -125,
    noVigProb: 0.568,
    evPercent: 2.2,
    confidence: 71,
    l5: "3/5",
    l10: "5/10",
    l20: "10/20",
    season: "6/13",
    tipTime: "Sun 4:25 PM ET",
    week: 12,
    projectedSnapPct: 90,
    injury: "None",
  },
  {
    id: "nfl-mahomes-comp",
    playerId: "mahomes",
    player: "Patrick Mahomes",
    team: "KC",
    opponent: "LV",
    position: "QB",
    market: "Completions",
    side: "Over",
    line: 23.5,
    americanOdds: -114,
    noVigProb: 0.545,
    evPercent: 3.0,
    confidence: 83,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "9/14",
    tipTime: "Sun 4:25 PM ET",
    week: 12,
    projectedSnapPct: 100,
    injury: "None",
  },
  {
    id: "nfl-allen-td",
    playerId: "allen",
    player: "Josh Allen",
    team: "BUF",
    opponent: "NYJ",
    position: "QB",
    market: "Pass TDs",
    side: "Over",
    line: 1.5,
    americanOdds: -135,
    noVigProb: 0.58,
    evPercent: 1.9,
    confidence: 77,
    l5: "4/5",
    l10: "7/10",
    l20: "12/20",
    season: "9/13",
    tipTime: "Sun 1:00 PM ET",
    week: 12,
    projectedSnapPct: 100,
    injury: "None",
  },
  {
    id: "nfl-jefferson-rec-cnt",
    playerId: "jefferson",
    player: "Justin Jefferson",
    team: "MIN",
    opponent: "GB",
    position: "WR",
    market: "Receptions",
    side: "Over",
    line: 5.5,
    americanOdds: -118,
    noVigProb: 0.554,
    evPercent: 2.6,
    confidence: 86,
    l5: "5/5",
    l10: "8/10",
    l20: "15/20",
    season: "11/13",
    tipTime: "Sun 8:20 PM ET",
    week: 12,
    projectedSnapPct: 94,
    injury: "None",
  },
];

export const mockNflPlayerCards: NflPlayerCard[] = [
  {
    id: "mahomes",
    name: "Patrick Mahomes",
    team: "KC",
    opponent: "LV",
    position: "QB",
    headshotInitials: "PM",
    projectedSnapPct: 100,
    seasonAvg: { passYds: 278.4 },
    topPropId: "nfl-mahomes-pass",
    confidence: 87,
    matchupNote: "LV ranks 27th in pass EPA allowed over L6.",
  },
  {
    id: "jefferson",
    name: "Justin Jefferson",
    team: "MIN",
    opponent: "GB",
    position: "WR",
    headshotInitials: "JJ",
    projectedSnapPct: 94,
    seasonAvg: { recYds: 91.2, receptions: 6.4 },
    topPropId: "nfl-jefferson-rec",
    confidence: 88,
    matchupNote: "GB allows 7.9 YPR to perimeter WRs this season.",
  },
  {
    id: "gibbs",
    name: "Jahmyr Gibbs",
    team: "DET",
    opponent: "CHI",
    position: "RB",
    headshotInitials: "JG",
    projectedSnapPct: 62,
    seasonAvg: { rushYds: 74.1, recYds: 28.3 },
    topPropId: "nfl-gibbs-rush",
    confidence: 85,
    matchupNote: "CHI sits 24th vs RB rush success rate.",
  },
  {
    id: "allen",
    name: "Josh Allen",
    team: "BUF",
    opponent: "NYJ",
    position: "QB",
    headshotInitials: "JA",
    projectedSnapPct: 100,
    seasonAvg: { passYds: 265.8 },
    topPropId: "nfl-allen-pass",
    confidence: 84,
    matchupNote: "NYJ pass D softened last 3 weeks vs mobile QBs.",
  },
  {
    id: "hurts",
    name: "Jalen Hurts",
    team: "PHI",
    opponent: "WAS",
    position: "QB",
    headshotInitials: "JH",
    projectedSnapPct: 100,
    seasonAvg: { passYds: 231.0, rushYds: 41.6 },
    topPropId: "nfl-hurts-rush",
    confidence: 82,
    matchupNote: "WAS allows 48.2 QB rush yards / g (bottom 5).",
  },
  {
    id: "lamb",
    name: "CeeDee Lamb",
    team: "DAL",
    opponent: "NYG",
    position: "WR",
    headshotInitials: "CL",
    projectedSnapPct: 92,
    seasonAvg: { recYds: 88.5, receptions: 6.9 },
    topPropId: "nfl-lamb-rec",
    confidence: 81,
    matchupNote: "NYG slot/perimeter mix is exploitable on volume.",
  },
];

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function parseHitRate(value: string): number {
  const [hits, samples] = value.split("/").map(Number);
  if (!samples) return 0;
  return hits / samples;
}
