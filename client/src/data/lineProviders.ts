/** Canonical line operators shown on every prop research report. */

export type LineProviderKind = "sportsbook" | "pickem";

export type LineProviderSpec = {
  slug: string;
  name: string;
  kind: LineProviderKind;
  notes: string;
  /** Short mark for the app switcher (no external logo assets). */
  mark: string;
  /** Accent for the switcher chip */
  accent: string;
};

export const CANONICAL_LINE_PROVIDERS: LineProviderSpec[] = [
  {
    slug: "prizepicks",
    name: "PrizePicks",
    kind: "pickem",
    mark: "PP",
    accent: "#8b5cf6",
    notes: "Primary pick'em comparison for WNBA/NBA. Live adapter pending — placeholder vs our projection.",
  },
  {
    slug: "underdog",
    name: "Underdog",
    kind: "pickem",
    mark: "UD",
    accent: "#f97316",
    notes: "Requires Underdog Fantasy API adapter.",
  },
  {
    slug: "fanduel",
    name: "FanDuel",
    kind: "sportsbook",
    mark: "FD",
    accent: "#1493ff",
    notes: "Live when The Odds API key is configured.",
  },
  {
    slug: "draftkings",
    name: "DraftKings",
    kind: "sportsbook",
    mark: "DK",
    accent: "#53d337",
    notes: "Live when The Odds API key is configured.",
  },
  {
    slug: "betmgm",
    name: "BetMGM",
    kind: "sportsbook",
    mark: "MGM",
    accent: "#c4a35a",
    notes: "Live when The Odds API key is configured.",
  },
  {
    slug: "caesars",
    name: "Caesars",
    kind: "sportsbook",
    mark: "CZR",
    accent: "#c9a227",
    notes: "Requires Caesars / Odds API book mapping.",
  },
  {
    slug: "fanatics",
    name: "Fanatics Sportsbook",
    kind: "sportsbook",
    mark: "FAN",
    accent: "#ef4444",
    notes: "Requires Fanatics Sportsbook adapter.",
  },
  {
    slug: "espnbet",
    name: "ESPN BET",
    kind: "sportsbook",
    mark: "ESPN",
    accent: "#d9782d",
    notes: "Requires ESPN BET / Odds API book mapping.",
  },
];

export function providerSpecByName(name: string): LineProviderSpec | undefined {
  const n = name.toLowerCase();
  return CANONICAL_LINE_PROVIDERS.find(
    (p) => p.name.toLowerCase() === n || p.slug === n.replace(/[\s_]/g, ""),
  );
}
