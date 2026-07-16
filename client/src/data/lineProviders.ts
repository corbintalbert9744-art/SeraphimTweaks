/** Canonical line operators shown on every prop research report. */

export type LineProviderKind = "sportsbook" | "pickem";

export type LineProviderSpec = {
  slug: string;
  name: string;
  kind: LineProviderKind;
  notes: string;
};

export const CANONICAL_LINE_PROVIDERS: LineProviderSpec[] = [
  {
    slug: "prizepicks",
    name: "PrizePicks",
    kind: "pickem",
    notes: "Primary pick'em comparison for WNBA/NBA. Live adapter pending — placeholder vs our projection.",
  },
  {
    slug: "underdog",
    name: "Underdog",
    kind: "pickem",
    notes: "Requires Underdog Fantasy API adapter.",
  },
  {
    slug: "fanduel",
    name: "FanDuel",
    kind: "sportsbook",
    notes: "Live when The Odds API key is configured.",
  },
  {
    slug: "draftkings",
    name: "DraftKings",
    kind: "sportsbook",
    notes: "Live when The Odds API key is configured.",
  },
  {
    slug: "betmgm",
    name: "BetMGM",
    kind: "sportsbook",
    notes: "Live when The Odds API key is configured.",
  },
  {
    slug: "caesars",
    name: "Caesars",
    kind: "sportsbook",
    notes: "Requires Caesars / Odds API book mapping.",
  },
  {
    slug: "fanatics",
    name: "Fanatics Sportsbook",
    kind: "sportsbook",
    notes: "Requires Fanatics Sportsbook adapter.",
  },
  {
    slug: "espnbet",
    name: "ESPN BET",
    kind: "sportsbook",
    notes: "Requires ESPN BET / Odds API book mapping.",
  },
];
