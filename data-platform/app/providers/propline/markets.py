"""PropLine sport keys, market maps, and display labels.

Docs: https://prop-line.com/docs · OpenAPI: https://api.prop-line.com/docs
Only markets documented by PropLine are listed. Unsupported leagues return
clear unavailable status — never fabricate lines.
"""

from __future__ import annotations

from typing import Optional

# Seraphim league → PropLine sport_key (odds-api compatible).
# WNBA / Tennis player-prop coverage is partial — see LEAGUE_SUPPORT.
SPORT_KEYS: dict[str, str] = {
    "NBA": "basketball_nba",
    "WNBA": "basketball_wnba",  # may be inactive — adapter reports unavailable
    "NFL": "football_nfl",  # game lines live; player props limited / preseason
    "MLB": "baseball_mlb",
    "NHL": "hockey_nhl",
    "Soccer": "soccer_epl",  # primary soccer slate; MLS via SOCCER_EXTRA_SPORTS
    "ATP": "tennis",
    "WTA": "tennis",
}

# Extra sport keys polled when the primary league key has no events (e.g. NBA off-season).
LEAGUE_EXTRA_SPORTS: dict[str, tuple[str, ...]] = {
    "NBA": ("basketball_nba_summer_league",),
    "Soccer": (),  # SOCCER_EXTRA_SPORTS used below
}

# Additional soccer competitions when expanding Soccer sync.
SOCCER_EXTRA_SPORTS: tuple[str, ...] = (
    "soccer_mls",
    "soccer_la_liga",
    "soccer_serie_a",
    "soccer_bundesliga",
    "soccer_ligue_1",
)

# PropLine market keys we request per league (player props only).
# Empty tuple = PropLine does not document player props for this league yet.
PROP_MARKETS: dict[str, tuple[str, ...]] = {
    "NBA": (
        "player_points",
        "player_rebounds",
        "player_assists",
        "player_threes",
        "player_steals",
        "player_blocks",
        "player_turnovers",
        "player_points_rebounds_assists",
        "player_double_double",
    ),
    # WNBA reuses NBA player-prop keys when the sport is active on PropLine.
    "WNBA": (
        "player_points",
        "player_rebounds",
        "player_assists",
        "player_threes",
        "player_steals",
        "player_blocks",
        "player_points_rebounds_assists",
    ),
    # NFL player props are not in PropLine's published market table (game lines only
    # until their football prop rollout). Keep empty → clear unavailable.
    "NFL": (),
    "MLB": (
        "pitcher_strikeouts",
        "pitcher_outs",
        "pitcher_earned_runs",
        "pitcher_hits_allowed",
        "batter_hits",
        "batter_home_runs",
        "batter_rbis",
        "batter_total_bases",
        "batter_stolen_bases",
        "batter_walks",
        "batter_runs",
    ),
    "NHL": (
        "player_goals",
        "player_shots_on_goal",
        "goalie_saves",
        "player_blocked_shots",
    ),
    "Soccer": (
        "anytime_goal_scorer",
        "first_goal_scorer",
        "2plus_goals",
        "goal_or_assist",
        "player_assists",
        "player_cards",
    ),
    # Tennis (PropLine sport key `tennis`) — PrizePicks / Underdog player props.
    # Market keys follow Odds-API style; unknown keys still titleize via market_label().
    "ATP": (
        "player_aces",
        "player_double_faults",
        "player_games_won",
        "player_break_points_won",
        "player_fantasy_score",
        "player_total_games",
        "player_sets_won",
    ),
    "WTA": (
        "player_aces",
        "player_double_faults",
        "player_games_won",
        "player_break_points_won",
        "player_fantasy_score",
        "player_total_games",
        "player_sets_won",
    ),
}

# PropLine market key → Seraphim board / analytics market label
MARKET_LABELS: dict[str, str] = {
    "player_points": "Points",
    "player_rebounds": "Rebounds",
    "player_assists": "Assists",
    "player_threes": "Threes",
    "player_steals": "Steals",
    "player_blocks": "Blocks",
    "player_turnovers": "Turnovers",
    "player_points_rebounds_assists": "PRA",
    "player_points_rebounds": "PR",
    "player_points_assists": "PA",
    "player_rebounds_assists": "RA",
    "player_double_double": "Double Double",
    "player_triple_double": "Triple Double",
    "pitcher_strikeouts": "Strikeouts",
    "pitcher_outs": "Outs",
    "pitcher_earned_runs": "Earned Runs",
    "pitcher_hits_allowed": "Hits Allowed",
    "batter_hits": "Hits",
    "batter_home_runs": "Home Runs",
    "batter_rbis": "RBIs",
    "batter_total_bases": "Total Bases",
    "batter_stolen_bases": "Stolen Bases",
    "batter_walks": "Walks",
    "batter_runs": "Runs",
    "player_goals": "Goals",
    "player_shots_on_goal": "Shots",
    "goalie_saves": "Saves",
    "player_blocked_shots": "Blocked Shots",
    "anytime_goal_scorer": "Goals",
    "first_goal_scorer": "First Goal",
    "2plus_goals": "2+ Goals",
    "goal_or_assist": "Goal + Assist",
    "player_cards": "Cards",
    "player_aces": "Aces",
    "player_double_faults": "Double Faults",
    "player_games_won": "Games Won",
    "player_break_points_won": "Break Points Won",
    "player_fantasy_score": "Fantasy Score",
    "player_total_games": "Total Games",
    "player_sets_won": "Sets Won",
}

# Reverse: Seraphim label → preferred PropLine market key(s)
LABEL_TO_MARKET_KEYS: dict[str, tuple[str, ...]] = {
    "Points": ("player_points",),
    "Rebounds": ("player_rebounds",),
    "Assists": ("player_assists",),
    "Threes": ("player_threes",),
    "Steals": ("player_steals",),
    "Blocks": ("player_blocks",),
    "Turnovers": ("player_turnovers",),
    "PRA": ("player_points_rebounds_assists",),
    "Double Double": ("player_double_double",),
    "Hits": ("batter_hits",),
    "Home Runs": ("batter_home_runs",),
    "RBIs": ("batter_rbis",),
    "Total Bases": ("batter_total_bases",),
    "Strikeouts": ("pitcher_strikeouts",),
    "Goals": ("player_goals", "anytime_goal_scorer", "Goals"),
    "Shots": ("player_shots_on_goal", "Shots"),
    "Shots on Target": ("player_shots_on_goal",),
    "Goal + Assist": ("goal_or_assist",),
    "Saves": ("goalie_saves",),
    "Aces": ("player_aces",),
    "Double Faults": ("player_double_faults",),
    "Games Won": ("player_games_won",),
    "Break Points Won": ("player_break_points_won",),
    "Fantasy Score": ("player_fantasy_score",),
    "Total Games": ("player_total_games", "player_games_won"),
    "Total Sets": ("player_sets_won",),
    "Sets Won": ("player_sets_won",),
    "Passes Attempted": (),
}

# Bookmakers returned by PropLine (docs). Used for UI catalog + kind.
PROPLINE_BOOKMAKERS: dict[str, dict[str, str]] = {
    "prizepicks": {"name": "PrizePicks", "kind": "pickem"},
    "underdog": {"name": "Underdog", "kind": "pickem"},
    "fanduel": {"name": "FanDuel", "kind": "sportsbook"},
    "draftkings": {"name": "DraftKings", "kind": "sportsbook"},
    "betmgm": {"name": "BetMGM", "kind": "sportsbook"},
    "bovada": {"name": "Bovada", "kind": "sportsbook"},
    "pinnacle": {"name": "Pinnacle", "kind": "sportsbook"},
    "betrivers": {"name": "BetRivers", "kind": "sportsbook"},
    "unibet": {"name": "Unibet", "kind": "sportsbook"},
    "onexbet": {"name": "1xBet", "kind": "sportsbook"},
    "sleeper": {"name": "Sleeper", "kind": "pickem"},
}

PICKEM_SLUGS = frozenset({"prizepicks", "underdog", "sleeper", "parlayplay", "dabble"})


def market_label(market_key: str) -> str:
    return MARKET_LABELS.get(market_key, market_key.replace("_", " ").title())


def market_keys_for_label(label: str) -> tuple[str, ...]:
    return LABEL_TO_MARKET_KEYS.get(label, ())


def normalize_league(league: str) -> str:
    raw = (league or "").strip()
    if raw.upper() == "SOCCER":
        return "Soccer"
    return raw.upper() if raw.upper() in {"NBA", "NFL", "WNBA", "MLB", "NHL", "ATP", "WTA"} else raw


def sport_key_for_league(league: str) -> Optional[str]:
    return SPORT_KEYS.get(normalize_league(league))


def prop_markets_for_league(league: str) -> tuple[str, ...]:
    return PROP_MARKETS.get(normalize_league(league), ())
