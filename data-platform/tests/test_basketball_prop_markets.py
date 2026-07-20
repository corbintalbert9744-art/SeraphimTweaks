"""Basketball pick'em market catalog — cores + combos for PrizePicks athletes."""

from app.providers.propline.markets import (
    BASKETBALL_PROP_MARKETS,
    PROP_MARKETS,
    market_label,
)


def test_nba_and_wnba_request_full_basketball_set():
    for league in ("NBA", "WNBA"):
        keys = set(PROP_MARKETS[league])
        for required in (
            "player_points",
            "player_rebounds",
            "player_assists",
            "player_threes",
            "player_steals",
            "player_blocks",
            "player_turnovers",
            "player_points_rebounds",
            "player_points_assists",
            "player_rebounds_assists",
            "player_points_rebounds_assists",
            "player_fantasy_score",
        ):
            assert required in keys, f"{league} missing {required}"
    assert set(PROP_MARKETS["NBA"]) == set(BASKETBALL_PROP_MARKETS)


def test_combo_and_fantasy_labels():
    assert market_label("player_points_rebounds") == "Pts+Rebs"
    assert market_label("player_points_assists") == "Pts+Asts"
    assert market_label("player_rebounds_assists") == "Rebs+Asts"
    assert market_label("player_points_rebounds_assists") == "PRA"
    assert market_label("player_fantasy_score") == "Fantasy Score"
    assert market_label("player_threes_made") == "Threes"
