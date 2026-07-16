import type { BuilderLeg } from "@/data/builderTypes";
import { getCachedNbaProp } from "@/lib/nbaLiveCache";
import { nbaToBuilderLeg, nflToBuilderLeg } from "@/lib/builderMappers";
import type { NflProp } from "@/data/nflMock";

const nflCache = new Map<string, NflProp>();

export function cacheNflBoardProps(props: NflProp[]) {
  for (const p of props) nflCache.set(p.id, p);
}

export function getCachedNflProp(id: string): NflProp | undefined {
  return nflCache.get(id);
}

export function propIdToBuilderLeg(propId: string): BuilderLeg | null {
  const liveNba = getCachedNbaProp(propId);
  if (liveNba) return nbaToBuilderLeg(liveNba);

  const liveNfl = getCachedNflProp(propId);
  if (liveNfl) return nflToBuilderLeg(liveNfl);

  return null;
}
