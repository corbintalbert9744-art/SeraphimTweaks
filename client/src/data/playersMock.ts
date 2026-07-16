import type { LeagueCode } from "@/data/mock";
import type { ResearchCheck } from "@/data/mock";

export interface PlayerGameLog {
  date: string;
  opponent: string;
  home: boolean;
  result: string;
  stats: Record<string, number>;
  minutesOrSnaps: number;
  primary: number;
}

export interface HitRateBlock {
  market: string;
  line: number;
  side: "Over" | "Under";
  l5: string;
  l10: string;
  l20: string;
  season: string;
}

export interface SplitBlock {
  label: string;
  samples: number;
  averages: Record<string, number>;
}

export interface PlayerStreak {
  label: string;
  detail: string;
  tone: "hot" | "neutral" | "cold";
}

export interface PlayerProfile {
  id: string;
  name: string;
  league: LeagueCode;
  team: string;
  opponent: string;
  position: string;
  initials: string;
  injury: "None" | "Probable" | "Questionable" | "Doubtful";
  injuryNote: string;
  tipTime: string;
  projectedWorkload: string;
  bio: string;
  seasonAverages: Record<string, number>;
  hitRates: HitRateBlock[];
  homeSplit: SplitBlock;
  awaySplit: SplitBlock;
  recentLogs: PlayerGameLog[];
  chartLine: number;
  chartStatLabel: string;
  streaks: PlayerStreak[];
  h2h: { record: string; note: string; meetings: Array<{ date: string; result: string; line: string }> };
  matchup: { title: string; bullets: string[]; defenseRank: string };
  researchScore: number;
  dataQualityScore: number;
  aiExplain: { verdict: "strong" | "neutral" | "weak"; headline: string; body: string };
  checks: ResearchCheck[];
  propIds: string[];
  recommendedPropIds: string[];
}

export const mockPlayerProfiles: Record<string, PlayerProfile> = {
  tatum: {
    id: "tatum",
    name: "Jayson Tatum",
    league: "NBA",
    team: "BOS",
    opponent: "ORL",
    position: "SF",
    initials: "JT",
    injury: "None",
    injuryNote: "Cleared — no designation on today's report.",
    tipTime: "7:30 PM ET",
    projectedWorkload: "37 min",
    bio: "Primary creator for Boston. High usage wing with stable minutes and strong scoring baselines.",
    seasonAverages: { pts: 27.1, reb: 8.2, ast: 4.9, fg3m: 3.1, min: 36.4 },
    hitRates: [
      { market: "Points", line: 27.5, side: "Over", l5: "5/5", l10: "9/10", l20: "16/20", season: "42/58" },
      { market: "Rebounds", line: 8.5, side: "Over", l5: "3/5", l10: "6/10", l20: "12/20", season: "27/58" },
      { market: "PRA", line: 40.5, side: "Over", l5: "4/5", l10: "8/10", l20: "14/20", season: "35/58" },
    ],
    homeSplit: { label: "Home", samples: 29, averages: { pts: 28.4, reb: 8.6, ast: 5.1 } },
    awaySplit: { label: "Away", samples: 29, averages: { pts: 25.8, reb: 7.8, ast: 4.7 } },
    recentLogs: [
      { date: "Mar 12", opponent: "POR", home: true, result: "W", stats: { pts: 31, reb: 9, ast: 5 }, minutesOrSnaps: 38, primary: 31 },
      { date: "Mar 10", opponent: "CHA", home: true, result: "W", stats: { pts: 29, reb: 7, ast: 6 }, minutesOrSnaps: 36, primary: 29 },
      { date: "Mar 08", opponent: "PHI", home: false, result: "L", stats: { pts: 26, reb: 8, ast: 4 }, minutesOrSnaps: 39, primary: 26 },
      { date: "Mar 05", opponent: "CLE", home: true, result: "W", stats: { pts: 33, reb: 10, ast: 3 }, minutesOrSnaps: 37, primary: 33 },
      { date: "Mar 03", opponent: "ATL", home: false, result: "W", stats: { pts: 28, reb: 6, ast: 7 }, minutesOrSnaps: 35, primary: 28 },
      { date: "Mar 01", opponent: "DET", home: true, result: "W", stats: { pts: 30, reb: 9, ast: 5 }, minutesOrSnaps: 36, primary: 30 },
      { date: "Feb 27", opponent: "NYK", home: false, result: "L", stats: { pts: 24, reb: 8, ast: 4 }, minutesOrSnaps: 38, primary: 24 },
      { date: "Feb 25", opponent: "MIA", home: true, result: "W", stats: { pts: 32, reb: 11, ast: 6 }, minutesOrSnaps: 37, primary: 32 },
    ],
    chartLine: 27.5,
    chartStatLabel: "Points",
    streaks: [
      { label: "5-game over streak", detail: "Cleared 27.5 points in each of last 5", tone: "hot" },
      { label: "3 straight 30+ min", detail: "Workload locked as primary option", tone: "hot" },
      { label: "Home scoring surge", detail: "28.4 PPG at TD Garden this season", tone: "neutral" },
    ],
    h2h: {
      record: "3-1 season series lean",
      note: "Tatum averaging 28.8 PTS in last 4 vs ORL.",
      meetings: [
        { date: "Jan 17", result: "W 119-108", line: "32 PTS" },
        { date: "Dec 22", result: "W 114-97", line: "27 PTS" },
        { date: "Nov 04", result: "L 104-110", line: "23 PTS" },
        { date: "Oct 30", result: "W 124-113", line: "33 PTS" },
      ],
    },
    matchup: {
      title: "vs Orlando Magic",
      defenseRank: "28th vs SF scoring",
      bullets: [
        "ORL ranks 28th in SF scoring defense over L10.",
        "Magic allow 26.9 FGA to primary wings at the point of attack.",
        "No minutes restriction flagged; starter projection locked.",
      ],
    },
    researchScore: 96,
    dataQualityScore: 91,
    aiExplain: {
      verdict: "strong",
      headline: "Strong play — form, matchup, and minutes align",
      body: "Tatum’s L10 clearing rate against 27.5 is elite, Orlando’s wing defense ranks near the bottom, and projected minutes remain full. Books are clustered with a favorable move, and injury noise is clean. This is a high Research Score lean, not a guaranteed outcome.",
    },
    checks: [
      { code: "L10", status: "pass", label: "L10: 9/10 vs 27.5" },
      { code: "MATCHUP", status: "pass", label: "Opponent ranks 28th vs SF" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Line moved in your favor" },
      { code: "MIN", status: "pass", label: "Projected 37 minutes" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
    propIds: ["nba-tatum-pts", "nba-tatum-reb"],
    recommendedPropIds: ["nba-tatum-pts"],
  },
  sga: {
    id: "sga",
    name: "Shai Gilgeous-Alexander",
    league: "NBA",
    team: "OKC",
    opponent: "MEM",
    position: "PG",
    initials: "SG",
    injury: "None",
    injuryNote: "Full go — no minutes restriction.",
    tipTime: "8:00 PM ET",
    projectedWorkload: "35 min",
    bio: "Elite isolation scorer with elite free-throw volume and stable mid-30s minutes.",
    seasonAverages: { pts: 32.4, reb: 5.1, ast: 6.3, fg3m: 1.4, min: 34.8 },
    hitRates: [
      { market: "Points", line: 31.5, side: "Over", l5: "5/5", l10: "9/10", l20: "17/20", season: "41/55" },
      { market: "PRA", line: 42.5, side: "Over", l5: "4/5", l10: "8/10", l20: "15/20", season: "39/55" },
    ],
    homeSplit: { label: "Home", samples: 28, averages: { pts: 33.1, reb: 5.0, ast: 6.5 } },
    awaySplit: { label: "Away", samples: 27, averages: { pts: 31.6, reb: 5.2, ast: 6.1 } },
    recentLogs: [
      { date: "Mar 11", opponent: "HOU", home: true, result: "W", stats: { pts: 35, reb: 4, ast: 7 }, minutesOrSnaps: 35, primary: 35 },
      { date: "Mar 09", opponent: "UTA", home: false, result: "W", stats: { pts: 38, reb: 6, ast: 5 }, minutesOrSnaps: 36, primary: 38 },
      { date: "Mar 07", opponent: "NOP", home: true, result: "W", stats: { pts: 31, reb: 5, ast: 8 }, minutesOrSnaps: 34, primary: 31 },
      { date: "Mar 04", opponent: "DAL", home: false, result: "L", stats: { pts: 29, reb: 3, ast: 6 }, minutesOrSnaps: 37, primary: 29 },
      { date: "Mar 02", opponent: "SAS", home: true, result: "W", stats: { pts: 34, reb: 7, ast: 9 }, minutesOrSnaps: 33, primary: 34 },
    ],
    chartLine: 31.5,
    chartStatLabel: "Points",
    streaks: [
      { label: "9/10 overs", detail: "Cleared 31.5 in 9 of last 10", tone: "hot" },
      { label: "FT volume steady", detail: "10+ FTA in 4 of last 5", tone: "hot" },
    ],
    h2h: {
      record: "2-0 recent",
      note: "SGA 34.5 PPG in last two vs MEM.",
      meetings: [
        { date: "Jan 22", result: "W 128-113", line: "36 PTS" },
        { date: "Dec 10", result: "W 119-108", line: "33 PTS" },
      ],
    },
    matchup: {
      title: "vs Memphis Grizzlies",
      defenseRank: "Bottom-8 vs lead guards",
      bullets: [
        "MEM allows 118.4 pace-adjusted points to lead guards.",
        "Free-throw rate stays elevated vs MEM L8.",
        "No back-to-back; full starter projection.",
      ],
    },
    researchScore: 93,
    dataQualityScore: 90,
    aiExplain: {
      verdict: "strong",
      headline: "Strong play — usage and matchup support the over",
      body: "SGA’s scoring floor rarely dips below 31 in healthy minutes. Memphis has leaked efficiency to primary ballhandlers, and both Points and PRA screens clear Research Score gates with clean injury and book agreement signals.",
    },
    checks: [
      { code: "L10", status: "pass", label: "L10: 9/10" },
      { code: "MATCHUP", status: "pass", label: "Soft vs lead guards" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Line moved in favor" },
      { code: "MIN", status: "pass", label: "Projected 35 minutes" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
    propIds: ["nba-sga-pts", "nba-sga-pra"],
    recommendedPropIds: ["nba-sga-pts", "nba-sga-pra"],
  },
  mahomes: {
    id: "mahomes",
    name: "Patrick Mahomes",
    league: "NFL",
    team: "KC",
    opponent: "LV",
    position: "QB",
    initials: "PM",
    injury: "None",
    injuryNote: "No designation — full practice week.",
    tipTime: "Sun 4:25 PM ET",
    projectedWorkload: "100% snaps",
    bio: "High-volume passer in a pass-leaning Chiefs offense. Completions and yardage baselines travel well in divisional spots.",
    seasonAverages: { passYds: 278.4, completions: 24.1, passTd: 2.1 },
    hitRates: [
      { market: "Pass Yards", line: 274.5, side: "Over", l5: "4/5", l10: "7/10", l20: "13/20", season: "9/14" },
      { market: "Completions", line: 23.5, side: "Over", l5: "4/5", l10: "7/10", l20: "13/20", season: "9/14" },
    ],
    homeSplit: { label: "Home", samples: 7, averages: { passYds: 286.2, completions: 24.8 } },
    awaySplit: { label: "Away", samples: 7, averages: { passYds: 270.6, completions: 23.4 } },
    recentLogs: [
      { date: "W11", opponent: "DEN", home: true, result: "W", stats: { passYds: 298, completions: 26, passTd: 3 }, minutesOrSnaps: 68, primary: 298 },
      { date: "W10", opponent: "BUF", home: false, result: "L", stats: { passYds: 271, completions: 22, passTd: 1 }, minutesOrSnaps: 71, primary: 271 },
      { date: "W9", opponent: "TB", home: true, result: "W", stats: { passYds: 312, completions: 28, passTd: 2 }, minutesOrSnaps: 65, primary: 312 },
      { date: "W8", opponent: "LV", home: false, result: "W", stats: { passYds: 289, completions: 25, passTd: 2 }, minutesOrSnaps: 62, primary: 289 },
      { date: "W7", opponent: "SF", home: true, result: "W", stats: { passYds: 255, completions: 21, passTd: 2 }, minutesOrSnaps: 64, primary: 255 },
    ],
    chartLine: 274.5,
    chartStatLabel: "Pass Yards",
    streaks: [
      { label: "4/5 overs", detail: "Cleared 274.5 pass yards in 4 of last 5", tone: "hot" },
      { label: "Divisional comfort", detail: "289 yards in prior meeting vs LV", tone: "neutral" },
    ],
    h2h: {
      record: "Dominant vs LV",
      note: "Mahomes 291 pass yards avg in last 3 vs Raiders.",
      meetings: [
        { date: "W8 2025", result: "W 31-17", line: "289 PASS" },
        { date: "W14 2024", result: "W 27-20", line: "302 PASS" },
        { date: "W5 2024", result: "W 24-13", line: "281 PASS" },
      ],
    },
    matchup: {
      title: "vs Las Vegas Raiders",
      defenseRank: "27th pass EPA allowed",
      bullets: [
        "LV ranks 27th in pass EPA allowed over L6.",
        "Raiders blitz rate creates chunk-yardage windows.",
        "Full starter snaps expected; no injury designation.",
      ],
    },
    researchScore: 87,
    dataQualityScore: 88,
    aiExplain: {
      verdict: "strong",
      headline: "Strong play — soft secondary + stable volume",
      body: "Las Vegas has leaked pass EPA, Mahomes’ recent yardage series sits above the number, and snap projection is full. Completions offer a correlated secondary lean if you want a smaller package.",
    },
    checks: [
      { code: "L10", status: "pass", label: "L10: 7/10" },
      { code: "MATCHUP", status: "pass", label: "Soft pass EPA defense" },
      { code: "BOOKS", status: "pass", label: "Sharp books agree" },
      { code: "MOVE", status: "pass", label: "Line moved +5.0 yards" },
      { code: "MIN", status: "pass", label: "100% snap projection" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
    propIds: ["nfl-mahomes-pass", "nfl-mahomes-comp"],
    recommendedPropIds: ["nfl-mahomes-pass"],
  },
  jefferson: {
    id: "jefferson",
    name: "Justin Jefferson",
    league: "NFL",
    team: "MIN",
    opponent: "GB",
    position: "WR",
    initials: "JJ",
    injury: "None",
    injuryNote: "Full participation — WR1 route tree intact.",
    tipTime: "Sun 8:20 PM ET",
    projectedWorkload: "94% snaps",
    bio: "Alpha WR1 with consistent target share. Yardage and reception floors remain elite in primetime spots.",
    seasonAverages: { recYds: 91.2, receptions: 6.4, targets: 9.8 },
    hitRates: [
      { market: "Receiving Yards", line: 84.5, side: "Over", l5: "4/5", l10: "8/10", l20: "14/20", season: "10/13" },
      { market: "Receptions", line: 5.5, side: "Over", l5: "5/5", l10: "8/10", l20: "15/20", season: "11/13" },
    ],
    homeSplit: { label: "Home", samples: 6, averages: { recYds: 96.4, receptions: 6.8 } },
    awaySplit: { label: "Away", samples: 7, averages: { recYds: 86.7, receptions: 6.1 } },
    recentLogs: [
      { date: "W11", opponent: "CHI", home: true, result: "W", stats: { recYds: 112, receptions: 8 }, minutesOrSnaps: 58, primary: 112 },
      { date: "W10", opponent: "JAX", home: false, result: "W", stats: { recYds: 88, receptions: 6 }, minutesOrSnaps: 55, primary: 88 },
      { date: "W9", opponent: "DET", home: true, result: "L", stats: { recYds: 79, receptions: 5 }, minutesOrSnaps: 61, primary: 79 },
      { date: "W8", opponent: "LAR", home: false, result: "W", stats: { recYds: 104, receptions: 7 }, minutesOrSnaps: 57, primary: 104 },
      { date: "W7", opponent: "DET", home: false, result: "L", stats: { recYds: 91, receptions: 6 }, minutesOrSnaps: 59, primary: 91 },
    ],
    chartLine: 84.5,
    chartStatLabel: "Rec Yards",
    streaks: [
      { label: "Target share locked", detail: "9+ targets in 4 of last 5", tone: "hot" },
      { label: "Receptions floor", detail: "5.5 cleared in 5 straight", tone: "hot" },
    ],
    h2h: {
      record: "Competitive NFCN",
      note: "Jefferson 9.2 targets/g in last 4 vs GB.",
      meetings: [
        { date: "W2 2025", result: "W 28-24", line: "97 REC" },
        { date: "W17 2024", result: "L 20-27", line: "71 REC" },
      ],
    },
    matchup: {
      title: "vs Green Bay Packers",
      defenseRank: "Allows 7.9 YPR to perimeter WRs",
      bullets: [
        "GB allows 7.9 YPR to perimeter WRs this season.",
        "Primetime script leans pass if early deficit risk.",
        "No snap restriction; WR1 route participation locked.",
      ],
    },
    researchScore: 88,
    dataQualityScore: 86,
    aiExplain: {
      verdict: "strong",
      headline: "Strong play — volume plus soft YPR allowed",
      body: "Jefferson’s reception floor is elite and Green Bay has leaked perimeter efficiency. Receiving yards carry the higher EV; receptions are the safer correlated companion if you stack.",
    },
    checks: [
      { code: "L10", status: "pass", label: "L10: 8/10" },
      { code: "MATCHUP", status: "pass", label: "Soft YPR allowed" },
      { code: "BOOKS", status: "pass", label: "Books clustered" },
      { code: "MOVE", status: "warn", label: "Line stable" },
      { code: "MIN", status: "pass", label: "94% snap projection" },
      { code: "INJ", status: "pass", label: "No injury concerns" },
    ],
    propIds: ["nfl-jefferson-rec", "nfl-jefferson-rec-cnt"],
    recommendedPropIds: ["nfl-jefferson-rec", "nfl-jefferson-rec-cnt"],
  },
};

export function getPlayerProfile(id: string): PlayerProfile | undefined {
  return mockPlayerProfiles[id];
}

export function listPlayerProfiles(): PlayerProfile[] {
  return Object.values(mockPlayerProfiles);
}
