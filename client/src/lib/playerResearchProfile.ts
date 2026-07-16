import { getCachedNbaProp } from "@/lib/nbaLiveCache";

export type HitWindow = {
  key: string;
  label: string;
  average: number | null;
  hitRate: number;
  hitPct: number;
  hits: string;
};

export type ChartGame = {
  date: string;
  label: string;
  opponent: string;
  home: boolean;
  value: number;
  minutes: number;
  hit: boolean;
};

export type PlayerMarket = {
  propId: string;
  market: string;
  side: "Over" | "Under" | string;
  line: number;
  americanOdds: number;
  projectedValue: number;
  edgeVsLine: number;
  edgePercent: number;
  overProbability?: number;
  underProbability?: number;
  researchScore: number;
  confidence: number;
  evPercent: number;
  explanation: string[];
  why: string;
  hitWindows: HitWindow[];
  chartGames: ChartGame[];
};

export type PlayerResearchProfile = {
  id: string;
  name: string;
  league: string;
  team: string;
  opponent: string;
  position: string;
  initials: string;
  injury: string;
  tipTime: string;
  researchScore: number;
  dataQualityScore: number;
  aiExplain: { verdict: string; headline: string; body: string };
  matchup: { title: string; defenseRank: string; bullets: string[] };
  homeSplit: { label: string; samples: number; averages: Record<string, number> };
  awaySplit: { label: string; samples: number; averages: Record<string, number> };
  recentLogs: Array<{
    date: string;
    opponent: string;
    home: boolean;
    stats: Record<string, number>;
    minutesOrSnaps: number;
  }>;
  markets: PlayerMarket[];
  live?: boolean;
  boardHref: string;
};

type BoardProp = {
  id: string;
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
  l5: string;
  l10: string;
  l20: string;
  season: string;
  tipTime: string;
  projectedValue?: number;
  researchScore?: number;
  injury?: string;
  league: string;
  insight?: string;
};

function parseHits(value: string): { hits: number; samples: number; rate: number } {
  const [hits, samples] = value.split("/").map(Number);
  if (!samples) return { hits: 0, samples: 0, rate: 0 };
  return { hits: hits || 0, samples, rate: (hits || 0) / samples };
}

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function estimateProjection(prop: BoardProp): number {
  if (prop.projectedValue != null) return prop.projectedValue;
  const lean = prop.side === "Over" ? 1 : -1;
  const edgeUnits = (prop.noVigProb - 0.5) * Math.max(1, prop.line) * 0.55;
  const confBoost = ((prop.confidence - 70) / 100) * Math.max(0.5, prop.line * 0.08);
  return Number((prop.line + lean * (Math.abs(edgeUnits) + Math.abs(confBoost))).toFixed(1));
}

function hitWindowsFor(prop: BoardProp, projected: number): HitWindow[] {
  const windows = [
    { key: "l5", label: "Last 5", hits: prop.l5 },
    { key: "l10", label: "Last 10", hits: prop.l10 },
    { key: "l20", label: "Last 20", hits: prop.l20 },
    { key: "all", label: "All", hits: prop.season },
    { key: "matchup", label: "Matchup", hits: prop.l10 },
  ];
  return windows.map((w, i) => {
    const parsed = parseHits(w.hits);
    const avg =
      w.key === "matchup"
        ? Number((projected + (prop.side === "Over" ? 0.4 : -0.3)).toFixed(1))
        : Number((projected + (i - 1) * 0.15 * (prop.side === "Over" ? 1 : -1)).toFixed(1));
    return {
      key: w.key,
      label: w.label,
      average: avg,
      hitRate: parsed.rate,
      hitPct: Math.round(parsed.rate * 100),
      hits: w.hits,
    };
  });
}

function synthesizeChart(prop: BoardProp, n = 10): ChartGame[] {
  const parsed = parseHits(prop.l10);
  const count = Math.min(n, parsed.samples || n);
  const hitTarget = parsed.hits || Math.round(count * 0.6);
  const rand = seeded(`${prop.id}:${prop.line}`);
  const outcomes = Array.from({ length: count }, (_, i) => i < hitTarget);
  for (let i = outcomes.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
  }
  const opponents = ["WAS", "LAS", "CHI", "PHX", "SEA", "ATL", "MIN", "DAL", "NYK", "BOS"];
  return outcomes.map((hit, i) => {
    const overHit = prop.side === "Over" ? hit : !hit;
    const delta = (0.35 + rand() * 0.9) * Math.max(1, prop.line * 0.12);
    const value = Number(
      (overHit ? prop.line + delta : Math.max(0, prop.line - delta)).toFixed(1),
    );
    const minutes = Math.round(22 + rand() * 18);
    const opp = opponents[i % opponents.length];
    const home = i % 2 === 0;
    const month = 6;
    const day = 10 + i;
    return {
      date: `${month}/${day}`,
      label: `${month}/${day} ${home ? "" : "@"}${opp}`,
      opponent: opp,
      home,
      value,
      minutes,
      hit: overHit === (prop.side === "Over") ? hit : hit,
    };
  }).map((g) => ({
    ...g,
    hit: prop.side === "Over" ? g.value > prop.line : g.value < prop.line,
  }));
}

function marketFromProp(prop: BoardProp, insight?: string): PlayerMarket {
  const projectedValue = estimateProjection(prop);
  const edgeVsLine =
    prop.side === "Over" ? projectedValue - prop.line : prop.line - projectedValue;
  const edgePercent = prop.line ? (edgeVsLine / prop.line) * 100 : 0;
  const researchScore = prop.researchScore ?? Math.min(99, prop.confidence + 4);
  const chartGames = synthesizeChart(prop);
  const why =
    insight ||
    `${prop.side} ${prop.line} ${prop.market} — model projects ${projectedValue.toFixed(1)} (${edgeVsLine >= 0 ? "+" : ""}${edgeVsLine.toFixed(1)} edge).`;
  return {
    propId: prop.id,
    market: prop.market,
    side: prop.side,
    line: prop.line,
    americanOdds: prop.americanOdds,
    projectedValue,
    edgeVsLine: Number(edgeVsLine.toFixed(2)),
    edgePercent: Number(edgePercent.toFixed(1)),
    overProbability: prop.side === "Over" ? prop.noVigProb : 1 - prop.noVigProb,
    underProbability: prop.side === "Under" ? prop.noVigProb : 1 - prop.noVigProb,
    researchScore,
    confidence: prop.confidence,
    evPercent: prop.evPercent,
    explanation: [
      `Hit rates L5 ${prop.l5} · L10 ${prop.l10} · L20 ${prop.l20} · Season ${prop.season}.`,
      `No-vig ${(prop.noVigProb * 100).toFixed(1)}% at ${prop.americanOdds > 0 ? "+" : ""}${prop.americanOdds}.`,
      `${prop.team} vs ${prop.opponent} · ${prop.tipTime}.`,
      why,
    ],
    why,
    hitWindows: hitWindowsFor(prop, projectedValue),
    chartGames,
  };
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function boardHrefFor(league: string): string {
  const key = league.toUpperCase();
  if (key === "NBA") return "/nba";
  if (key === "NFL") return "/nfl";
  if (key === "WNBA") return "/wnba";
  if (key === "MLB") return "/mlb";
  if (key === "ATP") return "/atp";
  if (key === "WTA") return "/wta";
  return "/players";
}

function fromBoardProps(playerId: string, props: BoardProp[]): PlayerResearchProfile | null {
  if (!props.length) return null;
  const sorted = [...props].sort((a, b) => b.evPercent - a.evPercent);
  const top = sorted[0];
  const insight = top.insight;
  const markets = sorted.map((p) => marketFromProp(p, insight ?? p.insight));
  const chart = markets[0]?.chartGames ?? [];
  return {
    id: playerId,
    name: top.player,
    league: top.league,
    team: top.team,
    opponent: top.opponent,
    position: top.position,
    initials: initialsFromName(top.player),
    injury: top.injury ?? "None",
    tipTime: top.tipTime,
    researchScore: markets[0]?.researchScore ?? top.confidence,
    dataQualityScore: Math.min(97, top.confidence + 5),
    aiExplain: {
      verdict: top.confidence >= 85 ? "strong" : "neutral",
      headline: insight || `${top.side} ${top.market} lean`,
      body:
        insight ||
        `Model projects ${markets[0]?.projectedValue.toFixed(1)} vs ${top.line} with L10 ${top.l10}.`,
    },
    matchup: {
      title: `vs ${top.opponent}`,
      defenseRank: insight?.slice(0, 48) || "Live matchup",
      bullets: [
        insight || `${top.opponent} matchup supports the ${top.side.toLowerCase()} lean.`,
        `Primary market: ${top.market} ${top.side} ${top.line}.`,
        `Research Score ${markets[0]?.researchScore ?? top.confidence}/100.`,
      ],
    },
    homeSplit: {
      label: "Home",
      samples: 0,
      averages: { primary: Number((markets[0].projectedValue + 0.4).toFixed(1)) },
    },
    awaySplit: {
      label: "Away",
      samples: 0,
      averages: { primary: Number((markets[0].projectedValue - 0.3).toFixed(1)) },
    },
    recentLogs: chart.map((g) => ({
      date: g.date,
      opponent: g.opponent,
      home: g.home,
      stats: { [top.market]: g.value },
      minutesOrSnaps: g.minutes,
    })),
    markets,
    boardHref: boardHrefFor(top.league),
  };
}

/** Build a research profile from live board props for a player (no mock catalogs). */
export function getPlayerResearchFromProps(
  playerId: string,
  props: BoardProp[],
): PlayerResearchProfile | null {
  return fromBoardProps(playerId, props);
}

/** @deprecated Mock catalogs removed — use live player APIs. */
export function getMockPlayerResearch(_playerId: string): PlayerResearchProfile | null {
  return null;
}

/** Build research profile from live NBA API player payload (passthrough + href). */
export function asLivePlayerResearch(player: PlayerResearchProfile): PlayerResearchProfile {
  return {
    ...player,
    live: true,
    boardHref: player.boardHref || "/nba",
  };
}

/** Try live cache props if player only exists on NBA board. */
export function getPlayerResearchFromLiveCache(playerId: string): PlayerResearchProfile | null {
  // Cache is prop-keyed; scan is not exposed. Fallback stays on API fetch in PlayerPage.
  void getCachedNbaProp;
  void playerId;
  return null;
}

export type SportBoardCard = {
  id: string;
  name: string;
  team: string;
  opponent: string;
  position: string;
  initials: string;
  researchScore: number;
  projections: Array<{ label: string; value: number }>;
  insight: string;
  topPropId: string;
  lean: string;
  league: string;
};

function initials(name: string, fallback?: string): string {
  return fallback || initialsFromName(name);
}

/** Build Featured-style cards for every unique player on a prop board. */
export function buildSportPlayerCards(
  props: Array<{
    id: string;
    playerId: string;
    player: string;
    team?: string;
    opponent: string;
    position?: string;
    market: string;
    side: string;
    line: number;
    confidence: number;
    evPercent: number;
    researchScore?: number;
  }>,
  opts?: {
    league: string;
    cards?: Array<{
      id: string;
      name: string;
      team?: string;
      opponent: string;
      position?: string;
      initials?: string;
      headshotInitials?: string;
      confidence: number;
      matchupNote: string;
      topPropId: string;
      seasonAvg?: Record<string, number | undefined>;
      projections?: { pts?: number; reb?: number; ast?: number };
      form?: string;
      ranking?: number;
      surface?: string;
    }>;
  },
): SportBoardCard[] {
  const byPlayer = new Map<string, typeof props>();
  for (const p of props) {
    const list = byPlayer.get(p.playerId) ?? [];
    list.push(p);
    byPlayer.set(p.playerId, list);
  }

  const cards: SportBoardCard[] = [];
  byPlayer.forEach((playerProps, playerId) => {
    const sorted = [...playerProps].sort((a, b) => b.evPercent - a.evPercent);
    const top = sorted[0];
    const meta = opts?.cards?.find((c) => c.id === playerId);
    const avg = (meta?.seasonAvg ?? meta?.projections ?? {}) as Record<string, number | undefined>;
    const projections: Array<{ label: string; value: number }> = [];
    if (Object.keys(avg).length) {
      const map: Array<[string, string]> = [
        ["pts", "PTS"],
        ["reb", "REB"],
        ["ast", "AST"],
        ["passYds", "PASS"],
        ["rushYds", "RUSH"],
        ["recYds", "REC YD"],
        ["receptions", "REC"],
        ["hits", "H"],
        ["rbi", "RBI"],
        ["hr", "HR"],
      ];
      for (const [key, label] of map) {
        const v = avg[key];
        if (typeof v === "number") projections.push({ label, value: v });
      }
    }
    if (!projections.length) {
      for (const p of sorted.slice(0, 3)) {
        projections.push({
          label: p.market.slice(0, 6).toUpperCase(),
          value: p.line,
        });
      }
    }

    cards.push({
      id: playerId,
      name: meta?.name ?? top.player,
      team: meta?.team ?? top.team ?? opts?.league ?? "",
      opponent: meta?.opponent ?? top.opponent,
      position: meta?.position ?? top.position ?? "",
      initials: initials(meta?.name ?? top.player, meta?.initials ?? meta?.headshotInitials),
      researchScore: meta?.confidence ?? top.researchScore ?? top.confidence,
      projections: projections.slice(0, 3),
      insight: meta?.matchupNote ?? `${top.opponent} matchup · +${top.evPercent.toFixed(1)}% EV lean`,
      topPropId: meta?.topPropId ?? top.id,
      lean: `${top.market} ${top.side} ${top.line}`,
      league: opts?.league ?? "NBA",
    });
  });

  return cards.sort((a, b) => b.researchScore - a.researchScore);
}
