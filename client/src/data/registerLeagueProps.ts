import { registerPropDetails } from "@/data/propsCatalog";
import { mockTennisProps, tennisToPropDetails } from "@/data/tennisMock";
import { mockWnbaProps, wnbaToPropDetails } from "@/data/wnbaMock";

/** Register non-NBA/NFL prop packs into the shared catalog (avoids circular imports). */
registerPropDetails([
  ...tennisToPropDetails(mockTennisProps),
  ...wnbaToPropDetails(mockWnbaProps),
]);
