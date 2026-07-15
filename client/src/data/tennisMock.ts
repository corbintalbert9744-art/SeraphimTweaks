import type { LeagueCode } from "@/data/mock";
import type { BuilderLeg } from "@/data/builderTypes";
import type { PropDetail } from "@/data/propsCatalog";
import type { ResearchCheck } from "@/data/mock";

export type TennisMarket = "Match Winner" | "Total Games" | "Set Handicap" | "Games Handicap";

export interface TennisProp {
  id: string;
  league: "ATP" | "WTA";
  playerId: string;
  player: string;
  opponent: string;
  country: string;
  market: TennisMarket;
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
  tournament: string;
  surface: "Hard" | "Clay" | "Grass";
  ranking: number;
}

export interface TennisPlayerCard {
  id: string;
  league: "ATP" | "WTA";
  name: string;
  country: string;
  opponent: string;
  ranking: number;
  initials: string;
  surface: string;
  topPropId: string;
  confidence: number;
  matchupNote: string;
  form: string;
}

export const tennisMarketOptions: Array<TennisMarket | "All"> = [
  "All",
  "Match Winner",
  "Total Games",
  "Set Handicap",
  "Games Handicap",
];

export const mockTennisProps: TennisProp[] = [
  {
    id: "atp-sinner-ml",
    league: "ATP",
    playerId: "sinner",
    player: "Jannik Sinner",
    opponent: "Alex de Minaur",
    country: "ITA",
    market: "Match Winner",
    side: "Over",
    line: 0.5,
    americanOdds: -185,
    noVigProb: 0.662,
    evPercent: 3.6,
    confidence: 91,
    l5: "5/5",
    l10: "8/10",
    l20: "16/20",
    season: "28/32",
    tipTime: "2:00 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 1,
  },
  {
    id: "atp-alcaraz-games",
    league: "ATP",
    playerId: "alcaraz",
    player: "Carlos Alcaraz",
    opponent: "Casper Ruud",
    country: "ESP",
    market: "Total Games",
    side: "Over",
    line: 22.5,
    americanOdds: -110,
    noVigProb: 0.534,
    evPercent: 3.2,
    confidence: 84,
    l5: "4/5",
    l10: "7/10",
    l20: "13/20",
    season: "22/30",
    tipTime: "4:00 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 2,
  },
  {
    id: "atp-medvedev-set",
    league: "ATP",
    playerId: "medvedev",
    player: "Daniil Medvedev",
    opponent: "Taylor Fritz",
    country: "RUS",
    market: "Set Handicap",
    side: "Over",
    line: -1.5,
    americanOdds: +145,
    noVigProb: 0.392,
    evPercent: 4.1,
    confidence: 78,
    l5: "3/5",
    l10: "6/10",
    l20: "11/20",
    season: "18/29",
    tipTime: "7:00 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 5,
  },
  {
    id: "wta-swiatek-ml",
    league: "WTA",
    playerId: "swiatek",
    player: "Iga Swiatek",
    opponent: "Elena Rybakina",
    country: "POL",
    market: "Match Winner",
    side: "Over",
    line: 0.5,
    americanOdds: -150,
    noVigProb: 0.612,
    evPercent: 2.9,
    confidence: 86,
    l5: "4/5",
    l10: "8/10",
    l20: "15/20",
    season: "26/31",
    tipTime: "1:00 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 1,
  },
  {
    id: "wta-gauff-games",
    league: "WTA",
    playerId: "gauff",
    player: "Coco Gauff",
    opponent: "Jessica Pegula",
    country: "USA",
    market: "Total Games",
    side: "Under",
    line: 21.5,
    americanOdds: -108,
    noVigProb: 0.528,
    evPercent: 3.4,
    confidence: 81,
    l5: "4/5",
    l10: "7/10",
    l20: "12/20",
    season: "19/28",
    tipTime: "3:30 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 3,
  },
  {
    id: "wta-sabalenka-games",
    league: "WTA",
    playerId: "sabalenka",
    player: "Aryna Sabalenka",
    opponent: "Qinwen Zheng",
    country: "BLR",
    market: "Games Handicap",
    side: "Over",
    line: -3.5,
    americanOdds: -115,
    noVigProb: 0.547,
    evPercent: 2.6,
    confidence: 79,
    l5: "3/5",
    l10: "7/10",
    l20: "13/20",
    season: "21/29",
    tipTime: "8:00 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 2,
  },
  {
    id: "atp-zverev-ml",
    league: "ATP",
    playerId: "zverev",
    player: "Alexander Zverev",
    opponent: "Ben Shelton",
    country: "GER",
    market: "Match Winner",
    side: "Over",
    line: 0.5,
    americanOdds: -140,
    noVigProb: 0.598,
    evPercent: 2.4,
    confidence: 75,
    l5: "3/5",
    l10: "6/10",
    l20: "12/20",
    season: "20/28",
    tipTime: "11:00 AM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 3,
  },
  {
    id: "wta-rybakina-games",
    league: "WTA",
    playerId: "rybakina",
    player: "Elena Rybakina",
    opponent: "Iga Swiatek",
    country: "KAZ",
    market: "Total Games",
    side: "Over",
    line: 20.5,
    americanOdds: -105,
    noVigProb: 0.519,
    evPercent: 3.8,
    confidence: 77,
    l5: "4/5",
    l10: "6/10",
    l20: "11/20",
    season: "17/26",
    tipTime: "1:00 PM ET",
    tournament: "Miami Open",
    surface: "Hard",
    ranking: 4,
  },
];

export const mockTennisPlayerCards: TennisPlayerCard[] = [
  {
    id: "sinner",
    league: "ATP",
    name: "Jannik Sinner",
    country: "ITA",
    opponent: "Alex de Minaur",
    ranking: 1,
    initials: "JS",
    surface: "Hard",
    topPropId: "atp-sinner-ml",
    confidence: 91,
    matchupNote: "Leads H2H 4-1; serve hold rate 89% on hard L10.",
    form: "8-2 L10",
  },
  {
    id: "alcaraz",
    league: "ATP",
    name: "Carlos Alcaraz",
    country: "ESP",
    opponent: "Casper Ruud",
    ranking: 2,
    initials: "CA",
    surface: "Hard",
    topPropId: "atp-alcaraz-games",
    confidence: 84,
    matchupNote: "High-variance rallies push totals in H2H.",
    form: "7-3 L10",
  },
  {
    id: "swiatek",
    league: "WTA",
    name: "Iga Swiatek",
    country: "POL",
    opponent: "Elena Rybakina",
    ranking: 1,
    initials: "IS",
    surface: "Hard",
    topPropId: "wta-swiatek-ml",
    confidence: 86,
    matchupNote: "Return pressure vs Rybakina second serve is the edge.",
    form: "8-2 L10",
  },
  {
    id: "gauff",
    league: "WTA",
    name: "Coco Gauff",
    country: "USA",
    opponent: "Jessica Pegula",
    ranking: 3,
    initials: "CG",
    surface: "Hard",
    topPropId: "wta-gauff-games",
    confidence: 81,
    matchupNote: "All-US QF lean under if first-strike holds.",
    form: "7-3 L10",
  },
  {
    id: "sabalenka",
    league: "WTA",
    name: "Aryna Sabalenka",
    country: "BLR",
    opponent: "Qinwen Zheng",
    ranking: 2,
    initials: "AS",
    surface: "Hard",
    topPropId: "wta-sabalenka-games",
    confidence: 79,
    matchupNote: "First-serve dominance supports games handicap.",
    form: "8-2 L10",
  },
  {
    id: "medvedev",
    league: "ATP",
    name: "Daniil Medvedev",
    country: "RUS",
    opponent: "Taylor Fritz",
    ranking: 5,
    initials: "DM",
    surface: "Hard",
    topPropId: "atp-medvedev-set",
    confidence: 78,
    matchupNote: "Straight-sets rate vs Fritz supports -1.5 sets.",
    form: "6-4 L10",
  },
];

export function tennisToBuilderLeg(prop: TennisProp): BuilderLeg {
  return {
    id: prop.id,
    league: prop.league,
    playerId: prop.playerId,
    player: prop.player,
    team: prop.country,
    opponent: prop.opponent,
    position: `R${prop.ranking}`,
    market: prop.market,
    side: prop.side,
    line: prop.line,
    americanOdds: prop.americanOdds,
    noVigProb: prop.noVigProb,
    evPercent: prop.evPercent,
    confidence: prop.confidence,
    tipTime: prop.tipTime,
    eventKey: `${prop.league}-${prop.player}-${prop.opponent}-${prop.tournament}`,
  };
}

export function tennisToPropDetails(props: TennisProp[]): PropDetail[] {
  return props.map((p) => {
    const checks: ResearchCheck[] = [
      { code: "L10", status: parseInt(p.l10) >= 7 ? "pass" : "warn", label: `L10: ${p.l10}` },
      { code: "MATCHUP", status: "pass", label: `Surface: ${p.surface}` },
      { code: "BOOKS", status: p.confidence >= 80 ? "pass" : "warn", label: p.confidence >= 80 ? "Sharp books agree" : "Mild book split" },
      { code: "MOVE", status: "pass", label: "Line tracked since open" },
      { code: "MIN", status: "unknown", label: "Workload n/a" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ];
    return {
      id: p.id,
      league: p.league as LeagueCode,
      playerId: p.playerId,
      player: p.player,
      team: p.country,
      opponent: p.opponent,
      position: `R${p.ranking}`,
      market: p.market,
      side: p.side,
      line: p.line,
      americanOdds: p.americanOdds,
      noVigProb: p.noVigProb,
      evPercent: p.evPercent,
      confidence: p.confidence,
      dqs: Math.min(96, p.confidence + 1),
      l5: p.l5,
      l10: p.l10,
      l20: p.l20,
      season: p.season,
      tipTime: p.tipTime,
      why: `${p.tournament} · ${p.market} research score ${p.confidence}/100`,
      checks,
      books: [
        { book: "Consensus", odds: p.americanOdds, line: p.line },
        { book: "Sharp A", odds: p.americanOdds + 4, line: p.line },
        { book: "Sharp B", odds: p.americanOdds - 3, line: p.line },
      ],
      movement: [
        { label: "Open", line: p.line, odds: p.americanOdds - 8 },
        { label: "AM", line: p.line, odds: p.americanOdds - 3 },
        { label: "Now", line: p.line, odds: p.americanOdds },
      ],
      analysis: [
        `${p.surface} court · ${p.tournament}.`,
        `Form windows L5 ${p.l5} · L10 ${p.l10} · Season ${p.season}.`,
        `No-vig ${(p.noVigProb * 100).toFixed(1)}% at offered price.`,
      ],
    };
  });
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function parseHitRate(value: string): number {
  const [hits, samples] = value.split("/").map(Number);
  if (!samples) return 0;
  return hits / samples;
}
