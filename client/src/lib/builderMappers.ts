import type { BuilderLeg } from "@/data/builderTypes";
import type { NbaProp } from "@/data/nbaMock";
import type { NflProp } from "@/data/nflMock";

export function nbaToBuilderLeg(prop: NbaProp): BuilderLeg {
  return {
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
  };
}

export function nflToBuilderLeg(prop: NflProp): BuilderLeg {
  return {
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
  };
}
