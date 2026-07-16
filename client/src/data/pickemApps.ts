/** Pick'em apps the user can research against.

 * Boards are scoped to one platform at a time — only players/lines available
 * on that app are shown. Selection persists in localStorage.
 */

export type PickemAppId = "prizepicks" | "underdog" | "sleeper" | "other";

export type PickemAppSpec = {
  id: PickemAppId;
  name: string;
  shortName: string;
  description: string;
  mark: string;
  accent: string;
};

export const PICKEM_APPS: PickemAppSpec[] = [
  {
    id: "prizepicks",
    name: "PrizePicks",
    shortName: "PrizePicks",
    description: "Only players and lines currently available on PrizePicks.",
    mark: "PP",
    accent: "#8b5cf6",
  },
  {
    id: "underdog",
    name: "Underdog Fantasy",
    shortName: "Underdog",
    description: "Only players and lines currently available on Underdog.",
    mark: "UD",
    accent: "#f97316",
  },
  {
    id: "sleeper",
    name: "Sleeper",
    shortName: "Sleeper",
    description: "Only players and lines currently available on Sleeper.",
    mark: "SL",
    accent: "#22c55e",
  },
  {
    id: "other",
    name: "Other pick'em platforms",
    shortName: "Other",
    description: "ParlayPlay, Dabble, and other pick'em apps with cached lines.",
    mark: "···",
    accent: "#eab308",
  },
];

export const PICKEM_APP_STORAGE_KEY = "seraphim.pickemApp";

export function pickemAppById(id: string | null | undefined): PickemAppSpec | undefined {
  if (!id) return undefined;
  return PICKEM_APPS.find((a) => a.id === id);
}

export function isPickemAppId(value: unknown): value is PickemAppId {
  return typeof value === "string" && PICKEM_APPS.some((a) => a.id === value);
}
