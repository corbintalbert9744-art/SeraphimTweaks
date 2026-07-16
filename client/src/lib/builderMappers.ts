import type { BuilderLeg } from "@/data/builderTypes";
import type { NbaProp } from "@/data/nbaMock";
import type { NflProp } from "@/data/nflMock";
import { withLegHitData } from "@/lib/legStats";

export function nbaToBuilderLeg(prop: NbaProp): BuilderLeg {
  return withLegHitData({
    id: prop.id,
    league: "NBA",
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

export function nflToBuilderLeg(prop: NflProp): BuilderLeg {
  return withLegHitData({
    id: prop.id,
    league: "NFL",
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
    eventKey: `${prop.team}-${prop.opponent}-W${prop.week}`,
    l10: prop.l10,
  });
}
