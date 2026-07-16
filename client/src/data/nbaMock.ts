export type NbaMarket =
  | "Points"
  | "Rebounds"
  | "Assists"
  | "Threes"
  | "PRA"
  | "Steals"
  | "Blocks";

export type NbaSortKey =
  | "edge"
  | "ev"
  | "confidence"
  | "researchScore"
  | "noVig"
  | "l10"
  | "player"
  | "line"
  | "projection";

export interface NbaProp {
  id: string;
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  position: string;
  market: NbaMarket;
  side: "Over" | "Under";
  line: number;
  americanOdds: number;
  noVigProb: number;
  evPercent: number;
  confidence: number;
  researchScore?: number;
  projectedValue?: number;
  edgeVsLine?: number | null;
  l5: string;
  l10: string;
  l20: string;
  season: string;
  tipTime: string;
  projectedMinutes: number;
  injury: "None" | "Probable" | "Questionable";
}

export interface NbaPlayerCard {
  id: string;
  name: string;
  team: string;
  opponent: string;
  position: string;
  headshotInitials: string;
  projectedMinutes: number;
  seasonAvg: {
    pts: number;
    reb: number;
    ast: number;
  };
  topPropId: string;
  confidence: number;
  matchupNote: string;
}

export const nbaMarketOptions: Array<NbaMarket | "All"> = [
  "All",
  "Points",
  "Rebounds",
  "Assists",
  "Threes",
  "PRA",
  "Steals",
  "Blocks",
];

export const nbaTeamOptions = [
  "All",
  "BOS",
  "OKC",
  "DEN",
  "NYK",
  "MIL",
  "MIN",
  "DAL",
  "PHX",
  "GSW",
  "LAL",
] as const;

export const mockNbaProps: NbaProp[] = [
  {
    id: "nba-tatum-pts",
    playerId: "tatum",
    player: "Jayson Tatum",
    team: "BOS",
    opponent: "ORL",
    position: "SF",
    market: "Points",
    side: "Over",
    line: 27.5,
    americanOdds: -108,
    noVigProb: 0.532,
    evPercent: 5.4,
    confidence: 96,
    l5: "5/5",
    l10: "9/10",
    l20: "16/20",
    season: "42/58",
    tipTime: "7:30 PM ET",
    projectedMinutes: 37,
    injury: "None",
  },
  {
    id: "nba-sga-pra",
    playerId: "sga",
    player: "Shai Gilgeous-Alexander",
    team: "OKC",
    opponent: "MEM",
    position: "PG",
    market: "PRA",
    side: "Over",
    line: 42.5,
    americanOdds: -102,
    noVigProb: 0.521,
    evPercent: 4.1,
    confidence: 91,
    l5: "4/5",
    l10: "8/10",
    l20: "15/20",
    season: "39/55",
    tipTime: "8:00 PM ET",
    projectedMinutes: 35,
    injury: "None",
  },
  {
    id: "nba-jokic-reb",
    playerId: "jokic",
    player: "Nikola Jokic",
    team: "DEN",
    opponent: "SAS",
    position: "C",
    market: "Rebounds",
    side: "Over",
    line: 12.5,
    americanOdds: -115,
    noVigProb: 0.548,
    evPercent: 3.8,
    confidence: 89,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "36/52",
    tipTime: "9:00 PM ET",
    projectedMinutes: 34,
    injury: "None",
  },
  {
    id: "nba-brunson-ast",
    playerId: "brunson",
    player: "Jalen Brunson",
    team: "NYK",
    opponent: "MIA",
    position: "PG",
    market: "Assists",
    side: "Over",
    line: 6.5,
    americanOdds: -110,
    noVigProb: 0.535,
    evPercent: 3.2,
    confidence: 84,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "31/54",
    tipTime: "7:00 PM ET",
    projectedMinutes: 36,
    injury: "None",
  },
  {
    id: "nba-giannis-pts",
    playerId: "giannis",
    player: "Giannis Antetokounmpo",
    team: "MIL",
    opponent: "CHI",
    position: "PF",
    market: "Points",
    side: "Over",
    line: 29.5,
    americanOdds: -105,
    noVigProb: 0.518,
    evPercent: 2.9,
    confidence: 78,
    l5: "3/5",
    l10: "7/10",
    l20: "12/20",
    season: "34/51",
    tipTime: "8:00 PM ET",
    projectedMinutes: 33,
    injury: "Probable",
  },
  {
    id: "nba-edwards-3pm",
    playerId: "edwards",
    player: "Anthony Edwards",
    team: "MIN",
    opponent: "POR",
    position: "SG",
    market: "Threes",
    side: "Over",
    line: 2.5,
    americanOdds: -120,
    noVigProb: 0.556,
    evPercent: 2.4,
    confidence: 81,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "33/53",
    tipTime: "8:00 PM ET",
    projectedMinutes: 36,
    injury: "None",
  },
  {
    id: "nba-luka-pts",
    playerId: "luka",
    player: "Luka Doncic",
    team: "DAL",
    opponent: "HOU",
    position: "PG",
    market: "Points",
    side: "Under",
    line: 31.5,
    americanOdds: -112,
    noVigProb: 0.541,
    evPercent: 2.1,
    confidence: 72,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "28/50",
    tipTime: "8:30 PM ET",
    projectedMinutes: 37,
    injury: "Questionable",
  },
  {
    id: "nba-booker-ast",
    playerId: "booker",
    player: "Devin Booker",
    team: "PHX",
    opponent: "LAC",
    position: "SG",
    market: "Assists",
    side: "Over",
    line: 5.5,
    americanOdds: +102,
    noVigProb: 0.487,
    evPercent: 4.6,
    confidence: 86,
    l5: "4/5",
    l10: "8/10",
    l20: "14/20",
    season: "30/49",
    tipTime: "10:00 PM ET",
    projectedMinutes: 35,
    injury: "None",
  },
  {
    id: "nba-curry-3pm",
    playerId: "curry",
    player: "Stephen Curry",
    team: "GSW",
    opponent: "SAC",
    position: "PG",
    market: "Threes",
    side: "Over",
    line: 4.5,
    americanOdds: -115,
    noVigProb: 0.544,
    evPercent: 3.5,
    confidence: 88,
    l5: "4/5",
    l10: "8/10",
    l20: "15/20",
    season: "37/56",
    tipTime: "10:00 PM ET",
    projectedMinutes: 34,
    injury: "None",
  },
  {
    id: "nba-ad-blk",
    playerId: "ad",
    player: "Anthony Davis",
    team: "LAL",
    opponent: "UTA",
    position: "C",
    market: "Blocks",
    side: "Over",
    line: 1.5,
    americanOdds: -130,
    noVigProb: 0.572,
    evPercent: 1.8,
    confidence: 69,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "29/48",
    tipTime: "10:30 PM ET",
    projectedMinutes: 32,
    injury: "Probable",
  },
  {
    id: "nba-jokic-ast",
    playerId: "jokic",
    player: "Nikola Jokic",
    team: "DEN",
    opponent: "SAS",
    position: "C",
    market: "Assists",
    side: "Over",
    line: 9.5,
    americanOdds: -105,
    noVigProb: 0.522,
    evPercent: 3.9,
    confidence: 90,
    l5: "5/5",
    l10: "9/10",
    l20: "16/20",
    season: "40/52",
    tipTime: "9:00 PM ET",
    projectedMinutes: 34,
    injury: "None",
  },
  {
    id: "nba-sga-pts",
    playerId: "sga",
    player: "Shai Gilgeous-Alexander",
    team: "OKC",
    opponent: "MEM",
    position: "PG",
    market: "Points",
    side: "Over",
    line: 31.5,
    americanOdds: -110,
    noVigProb: 0.538,
    evPercent: 4.8,
    confidence: 93,
    l5: "5/5",
    l10: "9/10",
    l20: "17/20",
    season: "41/55",
    tipTime: "8:00 PM ET",
    projectedMinutes: 35,
    injury: "None",
  },
  {
    id: "nba-tatum-reb",
    playerId: "tatum",
    player: "Jayson Tatum",
    team: "BOS",
    opponent: "ORL",
    position: "SF",
    market: "Rebounds",
    side: "Over",
    line: 8.5,
    americanOdds: -114,
    noVigProb: 0.546,
    evPercent: 2.7,
    confidence: 77,
    l5: "3/5",
    l10: "6/10",
    l20: "12/20",
    season: "27/58",
    tipTime: "7:30 PM ET",
    projectedMinutes: 37,
    injury: "None",
  },
  {
    id: "nba-edwards-pts",
    playerId: "edwards",
    player: "Anthony Edwards",
    team: "MIN",
    opponent: "POR",
    position: "SG",
    market: "Points",
    side: "Over",
    line: 26.5,
    americanOdds: -108,
    noVigProb: 0.529,
    evPercent: 3.3,
    confidence: 83,
    l5: "4/5",
    l10: "7/10",
    l20: "14/20",
    season: "35/53",
    tipTime: "8:00 PM ET",
    projectedMinutes: 36,
    injury: "None",
  },
];

export const mockNbaPlayerCards: NbaPlayerCard[] = [
  {
    id: "tatum",
    name: "Jayson Tatum",
    team: "BOS",
    opponent: "ORL",
    position: "SF",
    headshotInitials: "JT",
    projectedMinutes: 37,
    seasonAvg: { pts: 27.1, reb: 8.2, ast: 4.9 },
    topPropId: "nba-tatum-pts",
    confidence: 96,
    matchupNote: "ORL ranks 28th in SF scoring defense over L10.",
  },
  {
    id: "sga",
    name: "Shai Gilgeous-Alexander",
    team: "OKC",
    opponent: "MEM",
    position: "PG",
    headshotInitials: "SG",
    projectedMinutes: 35,
    seasonAvg: { pts: 32.4, reb: 5.1, ast: 6.3 },
    topPropId: "nba-sga-pts",
    confidence: 93,
    matchupNote: "MEM allows 118.4 pace-adjusted pts to lead guards.",
  },
  {
    id: "jokic",
    name: "Nikola Jokic",
    team: "DEN",
    opponent: "SAS",
    position: "C",
    headshotInitials: "NJ",
    projectedMinutes: 34,
    seasonAvg: { pts: 26.8, reb: 12.6, ast: 9.8 },
    topPropId: "nba-jokic-ast",
    confidence: 90,
    matchupNote: "SAS sits 26th vs center playmaking.",
  },
  {
    id: "curry",
    name: "Stephen Curry",
    team: "GSW",
    opponent: "SAC",
    position: "PG",
    headshotInitials: "SC",
    projectedMinutes: 34,
    seasonAvg: { pts: 24.9, reb: 4.4, ast: 6.1 },
    topPropId: "nba-curry-3pm",
    confidence: 88,
    matchupNote: "SAC allows 14.2 opponent threes / game (bottom 8).",
  },
  {
    id: "booker",
    name: "Devin Booker",
    team: "PHX",
    opponent: "LAC",
    position: "SG",
    headshotInitials: "DB",
    projectedMinutes: 35,
    seasonAvg: { pts: 25.7, reb: 4.1, ast: 6.8 },
    topPropId: "nba-booker-ast",
    confidence: 86,
    matchupNote: "LAC mid-pack vs SG creation; +EV on assists.",
  },
  {
    id: "brunson",
    name: "Jalen Brunson",
    team: "NYK",
    opponent: "MIA",
    position: "PG",
    headshotInitials: "JB",
    projectedMinutes: 36,
    seasonAvg: { pts: 26.2, reb: 3.4, ast: 7.1 },
    topPropId: "nba-brunson-ast",
    confidence: 84,
    matchupNote: "MIA allows 26.8 assists/g — soft vs primary ballhandlers.",
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
