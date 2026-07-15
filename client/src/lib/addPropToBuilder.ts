import type { BuilderLeg } from "@/data/builderTypes";
import { mockNbaProps } from "@/data/nbaMock";
import { mockNflProps } from "@/data/nflMock";
import { mockTennisProps, tennisToBuilderLeg } from "@/data/tennisMock";
import { mockWnbaProps, wnbaToBuilderLeg } from "@/data/wnbaMock";
import { mockMlbProps, mlbToBuilderLeg } from "@/data/mlbMock";
import { nbaToBuilderLeg, nflToBuilderLeg } from "@/lib/builderMappers";

export function propIdToBuilderLeg(propId: string): BuilderLeg | null {
  const nba = mockNbaProps.find((p) => p.id === propId);
  if (nba) return nbaToBuilderLeg(nba);
  const nfl = mockNflProps.find((p) => p.id === propId);
  if (nfl) return nflToBuilderLeg(nfl);
  const tennis = mockTennisProps.find((p) => p.id === propId);
  if (tennis) return tennisToBuilderLeg(tennis);
  const wnba = mockWnbaProps.find((p) => p.id === propId);
  if (wnba) return wnbaToBuilderLeg(wnba);
  const mlb = mockMlbProps.find((p) => p.id === propId);
  if (mlb) return mlbToBuilderLeg(mlb);
  return null;
}
