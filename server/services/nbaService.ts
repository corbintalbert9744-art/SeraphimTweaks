import {
  extractInjuries,
  fetchNbaScoreboard,
  fetchNbaSummary,
} from "../adapters/espnNba";

export async function getNbaGames(dates?: string) {
  return fetchNbaScoreboard(dates);
}

/**
 * Node-only fallback when the Python warehouse is down.
 * Never invents pick'em / sportsbook lines — live Prop of the Day comes from
 * data-platform once PROPLINE_API_KEY / SHARPAPI_API_KEY / ODDS_API_KEY are set.
 */
export async function buildFeaturedNbaProp(gameId?: string) {
  const board = await fetchNbaScoreboard();
  let game = gameId
    ? board.games.find((g) => g.id === gameId)
    : board.games.find((g) => !String(g.status).includes("FINAL")) ?? board.games[0];

  if (!game) {
    return { ok: false as const, error: "No NBA games available from ESPN", board };
  }

  const summary = await fetchNbaSummary(game.id);
  const injuries = extractInjuries(summary);
  return {
    ok: false as const,
    error:
      "Live Prop of the Day requires the data platform with an odds key (PROPLINE_API_KEY, SHARPAPI_API_KEY, or ODDS_API_KEY)",
    board,
    game,
    injuries: injuries.slice(0, 8),
  };
}

export async function buildCommandCenterPayload() {
  const board = await getNbaGames();
  const featured = await buildFeaturedNbaProp(board.games[0]?.id);
  const gamesStartingSoon = [...board.games]
    .sort((a, b) => a.tipoffAt.localeCompare(b.tipoffAt))
    .slice(0, 6);

  const generatedAt = new Date().toISOString();
  const injuries = featured.ok ? [] : featured.injuries ?? [];
  const notifications = injuries.slice(0, 4).map((inj, i) => ({
    id: `injury:${inj.player ?? i}`,
    kind: "injury" as const,
    tone: "injury" as const,
    title: `Injury · ${inj.player ?? "Player"}`,
    detail: `${inj.team ?? ""} ${inj.status ?? ""} ${inj.detail ?? ""}`.trim() || "Injury update",
    propId: null as string | null,
    league: "NBA",
    createdAt: generatedAt,
  }));

  return {
    generatedAt,
    leagueFocus: "NBA",
    board,
    gamesStartingSoon,
    bestEvToday: null,
    highestConfidence: null,
    propOfTheDay: null,
    topProps: [] as unknown[],
    bestNoVigPicks: [] as unknown[],
    notifications,
    injuryAlerts: injuries,
    savedParlays: [] as Array<{ id: string; title: string; legs: number }>,
    featured,
    providers: {
      novigRefreshSeconds: 300,
      odds: "unconfigured",
      note: "Set PROPLINE_API_KEY / SHARPAPI_API_KEY on seraphim-data for live lines",
    },
  };
}
