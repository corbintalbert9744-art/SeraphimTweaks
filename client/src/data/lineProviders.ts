/** Canonical line operators shown on every prop research report.

 * New upstream adapters (PropLine, SharpAPI, …) map onto these slugs —
 * the frontend does not need changes when a new source is added.
 */

export type LineProviderKind = "sportsbook" | "pickem";

export type LineProviderSpec = {
  slug: string;
  name: string;
  kind: LineProviderKind;
  notes: string;
  mark: string;
  accent: string;
};

export const CANONICAL_LINE_PROVIDERS: LineProviderSpec[] = [
  {
    slug: "prizepicks",
    name: "PrizePicks",
    kind: "pickem",
    mark: "PP",
    accent: "#8b5cf6",
    notes: "Live when a configured aggregator source returns PrizePicks — otherwise unavailable.",
  },
  {
    slug: "underdog",
    name: "Underdog",
    kind: "pickem",
    mark: "UD",
    accent: "#f97316",
    notes: "Live when PropLine / Underdog quotes arrive — otherwise unavailable.",
  },
  {
    slug: "fanduel",
    name: "FanDuel",
    kind: "sportsbook",
    mark: "FD",
    accent: "#1493ff",
    notes: "Live via PropLine / SharpAPI / The Odds API when keyed.",
  },
  {
    slug: "draftkings",
    name: "DraftKings",
    kind: "sportsbook",
    mark: "DK",
    accent: "#53d337",
    notes: "Live via PropLine / SharpAPI / The Odds API when keyed.",
  },
  {
    slug: "betmgm",
    name: "BetMGM",
    kind: "sportsbook",
    mark: "MGM",
    accent: "#c4a35a",
    notes: "Live via PropLine / SharpAPI / The Odds API when keyed.",
  },
  {
    slug: "caesars",
    name: "Caesars",
    kind: "sportsbook",
    mark: "CZR",
    accent: "#000000",
    notes: "Live via The Odds API (williamhill_us) / PropLine when keyed.",
  },
  {
    slug: "fanatics",
    name: "Fanatics",
    kind: "sportsbook",
    mark: "FAN",
    accent: "#e31837",
    notes: "Live via PropLine / The Odds API when keyed.",
  },
  {
    slug: "espnbet",
    name: "ESPN BET",
    kind: "sportsbook",
    mark: "ESPN",
    accent: "#ff003c",
    notes: "Live via PropLine / The Odds API when keyed.",
  },
  {
    slug: "bovada",
    name: "Bovada",
    kind: "sportsbook",
    mark: "BOV",
    accent: "#cc0000",
    notes: "Live via PropLine when keyed.",
  },
  {
    slug: "pinnacle",
    name: "Pinnacle",
    kind: "sportsbook",
    mark: "PIN",
    accent: "#1d4ed8",
    notes: "Live via PropLine / SharpAPI when keyed.",
  },
  {
    slug: "betrivers",
    name: "BetRivers",
    kind: "sportsbook",
    mark: "BR",
    accent: "#dc2626",
    notes: "Live via PropLine when keyed.",
  },
];

export function providerSpecByName(name: string): LineProviderSpec | undefined {
  const n = name.toLowerCase();
  return CANONICAL_LINE_PROVIDERS.find(
    (p) => p.name.toLowerCase() === n || p.slug === n.replace(/[\s_]/g, ""),
  );
}
