import type { BuilderLeg, LegGameSample } from "@/data/builderTypes";

export function parseHitRate(value: string): number {
  const [hits, samples] = value.split("/").map(Number);
  if (!samples) return 0;
  return hits / samples;
}

export function hitRatePct(value: string): number {
  return Math.round(parseHitRate(value) * 100);
}

export function shortPlayerName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export function playerInitials(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function marketCode(market: string): string {
  const map: Record<string, string> = {
    Points: "PTS",
    Rebounds: "REB",
    Assists: "AST",
    Threes: "3PM",
    PRA: "PRA",
    Steals: "STL",
    Blocks: "BLK",
    "Pass Yards": "PASS",
    Completions: "COMP",
    "Receiving Yards": "REC",
    Receptions: "REC",
    "Rush Yards": "RUSH",
    "Match Winner": "ML",
    "Total Games": "GAMES",
    "Set Handicap": "SETS",
    "Games Handicap": "HCP",
  };
  return map[market] ?? market.slice(0, 4).toUpperCase();
}

const OPP_POOL = [
  "SAC",
  "POR",
  "PHX",
  "LAL",
  "DEN",
  "DAL",
  "MIA",
  "BOS",
  "NYK",
  "CHI",
  "MIL",
  "ATL",
  "CLE",
  "DET",
  "ORL",
  "HOU",
  "OKC",
  "MIN",
  "GSW",
  "MEM",
];

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h || 1;
}

/**
 * Deterministic mock L10 game log from hit-rate string + line.
 * Places the correct number of hits/misses and spreads values around the line.
 */
export function buildLast10Games(
  propId: string,
  l10: string,
  line: number,
  side: "Over" | "Under",
): LegGameSample[] {
  const [hitsRaw, samplesRaw] = l10.split("/").map(Number);
  const samples = Math.min(10, samplesRaw || 10);
  const hits = Math.min(samples, hitsRaw || 0);
  const seed = hashSeed(propId);
  const hitFlags: boolean[] = [];
  for (let i = 0; i < samples; i++) hitFlags.push(i < hits);
  // shuffle deterministically
  for (let i = hitFlags.length - 1; i > 0; i--) {
    const j = (seed + i * 17) % (i + 1);
    [hitFlags[i], hitFlags[j]] = [hitFlags[j], hitFlags[i]];
  }

  const step = line >= 50 ? Math.max(3, Math.round(line * 0.04)) : line >= 10 ? 1.5 : 1;

  return hitFlags.map((isHit, i) => {
    const opp = OPP_POOL[(seed + i * 3) % OPP_POOL.length];
    const away = ((seed + i) % 2) === 0;
    const label = away ? `@${opp}` : opp;
    const delta = step * (1 + ((seed + i * 5) % 3));
    let value: number;
    if (side === "Over") {
      value = isHit ? line + delta : Math.max(0, line - delta);
    } else {
      value = isHit ? Math.max(0, line - delta) : line + delta;
    }
    // Round nicely for display
    value = line % 1 === 0.5 ? Math.round(value * 2) / 2 : Math.round(value);
    return { opponent: opp, label, value, hit: isHit };
  });
}

export function withLegHitData<T extends Omit<BuilderLeg, "shortName" | "initials" | "marketCode" | "l10Pct" | "last10">>(
  base: T & { l10: string },
): BuilderLeg {
  const l10Pct = hitRatePct(base.l10);
  return {
    ...base,
    shortName: shortPlayerName(base.player),
    initials: playerInitials(base.player),
    marketCode: marketCode(base.market),
    l10Pct,
    last10: buildLast10Games(base.id, base.l10, base.line, base.side),
  };
}

/** Recompute hit flags when Over/Under flips (values stay; hit status flips relative to line). */
export function recomputeLegSide(leg: BuilderLeg, side: "Over" | "Under"): BuilderLeg {
  if (leg.side === side) return leg;
  const last10 = leg.last10.map((g) => {
    const isHit = g.value === leg.line ? false : side === "Over" ? g.value > leg.line : g.value < leg.line;
    return { ...g, hit: isHit };
  });
  const hits = last10.filter((g) => g.hit).length;
  const l10Pct = Math.round((hits / last10.length) * 100);
  return {
    ...leg,
    side,
    last10,
    l10: `${hits}/${last10.length}`,
    l10Pct,
  };
}
