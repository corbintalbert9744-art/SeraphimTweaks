import type { NbaProp } from "@/data/nbaMock";
import type { PropDetail } from "@/data/propsCatalog";

const propsById = new Map<string, NbaProp>();
const detailsById = new Map<string, PropDetail>();

export function cacheNbaBoardProps(props: NbaProp[]) {
  for (const p of props) propsById.set(p.id, p);
}

export function getCachedNbaProp(id: string): NbaProp | undefined {
  return propsById.get(id);
}

export function cacheNbaPropDetail(detail: PropDetail) {
  detailsById.set(detail.id, detail);
  propsById.set(detail.id, {
    id: detail.id,
    playerId: detail.playerId,
    player: detail.player,
    team: detail.team,
    opponent: detail.opponent,
    position: detail.position,
    market: detail.market as NbaProp["market"],
    side: detail.side,
    line: detail.line,
    americanOdds: detail.americanOdds,
    noVigProb: detail.noVigProb,
    evPercent: detail.evPercent,
    confidence: detail.confidence,
    l5: detail.l5,
    l10: detail.l10,
    l20: detail.l20,
    season: detail.season,
    tipTime: detail.tipTime,
    projectedMinutes: 32,
    injury: "None",
  });
}

export function getCachedNbaPropDetail(id: string): PropDetail | undefined {
  return detailsById.get(id);
}

export function propDetailFromNbaProp(p: NbaProp, extras?: Partial<PropDetail>): PropDetail {
  const detail = asPropDetailFromApi({
    ...p,
    researchScore: extras?.researchScore ?? p.confidence,
    dqs: extras?.dqs ?? 70,
    noVigOpposite: extras?.noVigOpposite ?? Math.max(0, 1 - p.noVigProb),
    why: extras?.why ?? `${p.player} ${p.market} model lean`,
    books: extras?.books,
    movement: extras?.movement,
    analysis: extras?.analysis,
    checks: extras?.checks,
    opponentDefense: extras?.opponentDefense,
    similarPropIds: extras?.similarPropIds,
  } as unknown as Record<string, unknown>);
  cacheNbaPropDetail(detail);
  return detail;
}


export function asNbaPropFromApi(row: Record<string, unknown>): NbaProp {
  return {
    id: String(row.id),
    playerId: String(row.playerId ?? ""),
    player: String(row.player ?? ""),
    team: String(row.team ?? ""),
    opponent: String(row.opponent ?? ""),
    position: String(row.position ?? "G"),
    market: row.market as NbaProp["market"],
    side: (row.side === "Under" ? "Under" : "Over") as "Over" | "Under",
    line: Number(row.line ?? 0),
    americanOdds: Number(row.americanOdds ?? -110),
    noVigProb: Number(row.noVigProb ?? 0.5),
    evPercent: Number(row.evPercent ?? 0),
    confidence: Number(row.confidence ?? 50),
    l5: String(row.l5 ?? "0/0"),
    l10: String(row.l10 ?? "0/0"),
    l20: String(row.l20 ?? "0/0"),
    season: String(row.season ?? "0/0"),
    tipTime: String(row.tipTime ?? ""),
    projectedMinutes: Number(row.projectedMinutes ?? 32),
    injury: (row.injury as NbaProp["injury"]) || "None",
  };
}

export function asPropDetailFromApi(row: Record<string, unknown>): PropDetail {
  const side = (row.side === "Under" ? "Under" : "Over") as "Over" | "Under";
  const noVig = Number(row.noVigProb ?? 0.5);
  return {
    id: String(row.id),
    league: "NBA",
    playerId: String(row.playerId ?? ""),
    player: String(row.player ?? ""),
    team: String(row.team ?? ""),
    opponent: String(row.opponent ?? ""),
    position: String(row.position ?? "G"),
    market: String(row.market ?? "Points"),
    side,
    line: Number(row.line ?? 0),
    americanOdds: Number(row.americanOdds ?? -110),
    noVigProb: noVig,
    noVigOpposite: Number(row.noVigOpposite ?? Math.max(0, 1 - noVig)),
    evPercent: Number(row.evPercent ?? 0),
    confidence: Number(row.confidence ?? 50),
    researchScore: Number(row.researchScore ?? row.confidence ?? 50),
    dqs: Number(row.dqs ?? 50),
    l5: String(row.l5 ?? "0/0"),
    l10: String(row.l10 ?? "0/0"),
    l20: String(row.l20 ?? "0/0"),
    season: String(row.season ?? "0/0"),
    tipTime: String(row.tipTime ?? ""),
    why: String(row.why ?? row.matchupNote ?? "Seraphim model estimate"),
    checks: Array.isArray(row.checks) ? (row.checks as PropDetail["checks"]) : [],
    books: Array.isArray(row.books) && (row.books as PropDetail["books"]).length
      ? (row.books as PropDetail["books"])
      : [
          {
            book: "DraftKings",
            line: Number(row.line ?? 0),
            over: Number(row.americanOdds ?? -110),
            under: -110,
          },
        ],
    movement: Array.isArray(row.movement) ? (row.movement as PropDetail["movement"]) : [],
    analysis: Array.isArray(row.analysis)
      ? (row.analysis as string[])
      : Array.isArray(row.explanation)
        ? (row.explanation as string[])
        : [],
    opponentDefense: (row.opponentDefense as PropDetail["opponentDefense"]) ?? {
      rank: 15,
      of: 30,
      label: `vs ${String(row.opponent ?? "OPP")}`,
      note: "Matchup rankings fill as team_stats land in the warehouse.",
    },
    similarPropIds: Array.isArray(row.similarPropIds) ? (row.similarPropIds as string[]) : [],
  };
}
