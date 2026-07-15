export type LeagueCode = "NBA" | "NFL" | "ATP" | "WTA" | "WNBA" | "MLB";

export type ResearchCheckStatus = "pass" | "warn" | "fail" | "unknown";

export interface ResearchCheck {
  code: string;
  status: ResearchCheckStatus;
  label: string;
}

export interface PropRow {
  id: string;
  player: string;
  team: string;
  league: LeagueCode;
  market: string;
  line: string;
  odds: string;
  evPercent: number;
  researchScore: number;
  dqs: number;
  l10: string;
  why: string;
  checks: ResearchCheck[];
}

export interface StatCardData {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral";
  hint: string;
}

export interface LineMovePoint {
  label: string;
  value: number;
}

export interface LineMovementItem {
  id: string;
  player: string;
  market: string;
  league: LeagueCode;
  openLine: string;
  currentLine: string;
  direction: "favor" | "against";
  deltaLabel: string;
  series: LineMovePoint[];
}

export interface FeedItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "info" | "success" | "warn";
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  league: LeagueCode;
  team: string;
  position: string;
}

export interface EvLeader {
  id: string;
  player: string;
  market: string;
  league: LeagueCode;
  evPercent: number;
  researchScore: number;
  odds: string;
}

export const mockStatCards: StatCardData[] = [
  {
    id: "props",
    label: "Props Tracked",
    value: "1,284",
    delta: "+46 today",
    deltaTone: "up",
    hint: "Across five leagues",
  },
  {
    id: "ev",
    label: "Avg Top EV",
    value: "+4.8%",
    delta: "+0.6 pts",
    deltaTone: "up",
    hint: "vs no-vig consensus",
  },
  {
    id: "research",
    label: "Avg Research Score",
    value: "81",
    delta: "Stable",
    deltaTone: "neutral",
    hint: "Top 25 props board",
  },
  {
    id: "dqs",
    label: "Data Quality",
    value: "88/100",
    delta: "2 stale flags",
    deltaTone: "down",
    hint: "Books + injuries freshness",
  },
];

export const mockTopProps: PropRow[] = [
  {
    id: "p1",
    player: "Jayson Tatum",
    team: "BOS",
    league: "NBA",
    market: "Points",
    line: "Over 27.5",
    odds: "-108",
    evPercent: 5.4,
    researchScore: 96,
    dqs: 91,
    l10: "9/10",
    why: "Elite L10 + soft matchup + clean minutes",
    checks: [
      { code: "L10", status: "pass", label: "L10: 9/10" },
      { code: "MATCHUP", status: "pass", label: "Opponent ranks 28th vs SF" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Line moved in your favor" },
      { code: "MIN", status: "pass", label: "Projected 37 minutes" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
  },
  {
    id: "p2",
    player: "Caitlin Clark",
    team: "IND",
    league: "WNBA",
    market: "Assists",
    line: "Over 8.5",
    odds: "+105",
    evPercent: 4.9,
    researchScore: 88,
    dqs: 84,
    l10: "8/10",
    why: "Usage spike + favorable pace",
    checks: [
      { code: "L10", status: "pass", label: "L10: 8/10" },
      { code: "MATCHUP", status: "pass", label: "Opp allows 26.1 AST/g" },
      { code: "BOOKS", status: "pass", label: "Books clustered" },
      { code: "MOVE", status: "warn", label: "Line stable (no steam)" },
      { code: "MIN", status: "pass", label: "Projected 34 minutes" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
  },
  {
    id: "p3",
    player: "Patrick Mahomes",
    team: "KC",
    league: "NFL",
    market: "Pass Yards",
    line: "Over 274.5",
    odds: "-115",
    evPercent: 4.2,
    researchScore: 79,
    dqs: 76,
    l10: "7/10",
    why: "Game script leans pass-heavy",
    checks: [
      { code: "L10", status: "pass", label: "L10: 7/10" },
      { code: "MATCHUP", status: "warn", label: "Opp ranks 12th vs QB" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Line moved +2.5 yards" },
      { code: "MIN", status: "unknown", label: "Snap projection n/a" },
      { code: "INJ", status: "warn", label: "WR2 questionable" },
    ],
  },
  {
    id: "p4",
    player: "Jannik Sinner",
    team: "ITA",
    league: "ATP",
    market: "Match Winner",
    line: "Sinner ML",
    odds: "-185",
    evPercent: 3.6,
    researchScore: 91,
    dqs: 89,
    l10: "8/10",
    why: "Form + serve dominance on hard",
    checks: [
      { code: "L10", status: "pass", label: "L10: 8/10 wins" },
      { code: "MATCHUP", status: "pass", label: "H2H leads 4-1" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Shortened from -170" },
      { code: "MIN", status: "unknown", label: "Workload n/a" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
  },
  {
    id: "p5",
    player: "Iga Swiatek",
    team: "POL",
    league: "WTA",
    market: "Total Games",
    line: "Under 21.5",
    odds: "-110",
    evPercent: 3.1,
    researchScore: 74,
    dqs: 82,
    l10: "6/10",
    why: "Opponent struggle on return",
    checks: [
      { code: "L10", status: "warn", label: "L10: 6/10" },
      { code: "MATCHUP", status: "pass", label: "Opp return rank 41" },
      { code: "BOOKS", status: "pass", label: "Books agree" },
      { code: "MOVE", status: "fail", label: "Line moved against" },
      { code: "MIN", status: "unknown", label: "n/a" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
  },
  {
    id: "p6",
    player: "Shai Gilgeous-Alexander",
    team: "OKC",
    league: "NBA",
    market: "PRA",
    line: "Over 42.5",
    odds: "-102",
    evPercent: 2.8,
    researchScore: 85,
    dqs: 90,
    l10: "8/10",
    why: "Usage locked + pace up",
    checks: [
      { code: "L10", status: "pass", label: "L10: 8/10" },
      { code: "MATCHUP", status: "pass", label: "Opp ranks 24th vs PG" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Line moved in favor" },
      { code: "MIN", status: "pass", label: "Projected 35 minutes" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
  },
];

export const mockEvLeaders: EvLeader[] = mockTopProps
  .slice()
  .sort((a, b) => b.evPercent - a.evPercent)
  .slice(0, 5)
  .map((p) => ({
    id: p.id,
    player: p.player,
    market: `${p.market} ${p.line}`,
    league: p.league,
    evPercent: p.evPercent,
    researchScore: p.researchScore,
    odds: p.odds,
  }));

export const mockLineMovements: LineMovementItem[] = [
  {
    id: "lm1",
    player: "Jayson Tatum",
    market: "Points O 27.5",
    league: "NBA",
    openLine: "26.5",
    currentLine: "27.5",
    direction: "favor",
    deltaLabel: "+1.0 pts",
    series: [
      { label: "Open", value: 26.5 },
      { label: "10a", value: 26.5 },
      { label: "1p", value: 27.0 },
      { label: "4p", value: 27.0 },
      { label: "Now", value: 27.5 },
    ],
  },
  {
    id: "lm2",
    player: "Patrick Mahomes",
    market: "Pass Yds O 274.5",
    league: "NFL",
    openLine: "269.5",
    currentLine: "274.5",
    direction: "favor",
    deltaLabel: "+5.0 yds",
    series: [
      { label: "Open", value: 269.5 },
      { label: "Mon", value: 271.5 },
      { label: "Tue", value: 272.5 },
      { label: "Wed", value: 274.5 },
      { label: "Now", value: 274.5 },
    ],
  },
  {
    id: "lm3",
    player: "Iga Swiatek",
    market: "Total Games U 21.5",
    league: "WTA",
    openLine: "22.5",
    currentLine: "21.5",
    direction: "against",
    deltaLabel: "−1.0 games",
    series: [
      { label: "Open", value: 22.5 },
      { label: "AM", value: 22.5 },
      { label: "Noon", value: 22.0 },
      { label: "PM", value: 21.5 },
      { label: "Now", value: 21.5 },
    ],
  },
];

export const mockFeed: FeedItem[] = [
  {
    id: "f1",
    title: "Odds refresh complete",
    detail: "NBA + WNBA main markets updated from provider adapter.",
    time: "2m ago",
    tone: "success",
  },
  {
    id: "f2",
    title: "Injury flag raised",
    detail: "KC WR2 listed Questionable — DQS adjusted on related props.",
    time: "18m ago",
    tone: "warn",
  },
  {
    id: "f3",
    title: "Research scores recomputed",
    detail: "1,284 props scored on research_score_v1 checklist.",
    time: "32m ago",
    tone: "info",
  },
  {
    id: "f4",
    title: "ATP rankings snapshot",
    detail: "Daily rankings ingested for matchup modules.",
    time: "1h ago",
    tone: "info",
  },
  {
    id: "f5",
    title: "Line steam detected",
    detail: "Tatum points moved 26.5 → 27.5 across sharp books.",
    time: "1h ago",
    tone: "success",
  },
];

export const mockPlayers: PlayerSearchResult[] = [
  { id: "tatum", name: "Jayson Tatum", league: "NBA", team: "Boston Celtics", position: "SF" },
  { id: "sga", name: "Shai Gilgeous-Alexander", league: "NBA", team: "OKC Thunder", position: "PG" },
  { id: "mahomes", name: "Patrick Mahomes", league: "NFL", team: "Kansas City Chiefs", position: "QB" },
  { id: "jefferson", name: "Justin Jefferson", league: "NFL", team: "Minnesota Vikings", position: "WR" },
  { id: "clark", name: "Caitlin Clark", league: "WNBA", team: "Indiana Fever", position: "G" },
  { id: "wilson", name: "A'ja Wilson", league: "WNBA", team: "Las Vegas Aces", position: "F" },
  { id: "sinner", name: "Jannik Sinner", league: "ATP", team: "Italy", position: "RHB" },
  { id: "swiatek", name: "Iga Swiatek", league: "WTA", team: "Poland", position: "RHB" },
];

export const mockChartEvTrend = [
  { label: "Mon", value: 3.2 },
  { label: "Tue", value: 3.8 },
  { label: "Wed", value: 3.1 },
  { label: "Thu", value: 4.4 },
  { label: "Fri", value: 4.1 },
  { label: "Sat", value: 5.0 },
  { label: "Sun", value: 4.8 },
];

export const mockChartVolume = [
  { label: "NBA", value: 420 },
  { label: "NFL", value: 310 },
  { label: "WNBA", value: 180 },
  { label: "ATP", value: 220 },
  { label: "WTA", value: 154 },
];

export const leagueMeta: Record<
  LeagueCode,
  { name: string; blurb: string; gamesToday: number; propsLive: number }
> = {
  NBA: {
    name: "NBA",
    blurb: "Player props, matchups, and research boards for tonight’s slate.",
    gamesToday: 8,
    propsLive: 426,
  },
  NFL: {
    name: "NFL",
    blurb: "Passing, rushing, and receiving research with weekly context.",
    gamesToday: 14,
    propsLive: 318,
  },
  ATP: {
    name: "ATP Tennis",
    blurb: "Match markets, form, and H2H research on the men’s tour.",
    gamesToday: 22,
    propsLive: 190,
  },
  WTA: {
    name: "WTA Tennis",
    blurb: "Women’s tour match pricing and form checkpoints.",
    gamesToday: 18,
    propsLive: 164,
  },
  WNBA: {
    name: "WNBA",
    blurb: "Player props and pace/matchup context for the WNBA slate.",
    gamesToday: 4,
    propsLive: 142,
  },
  MLB: {
    name: "MLB",
    blurb: "Hits, strikeouts, and counting props with daily slate research.",
    gamesToday: 12,
    propsLive: 268,
  },
};
