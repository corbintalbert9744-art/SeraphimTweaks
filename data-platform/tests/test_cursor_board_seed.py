from app.ingestion.cursor_board_seed import load_cursor_board_seed
from app.ingestion.platform_board import (
    filter_live_betting_site_props,
    is_live_betting_site_prop,
)


def test_load_wnba_cursor_seed():
    seed = load_cursor_board_seed("WNBA", "prizepicks")
    assert seed is not None
    assert seed["count"] == 187
    assert len(seed["props"]) == 187
    assert seed["source"] == "cursor-seed"
    assert seed["rateLimited"] is False
    assert all(is_live_betting_site_prop(p) for p in seed["props"])


def test_load_seed_ignores_other_platform():
    assert load_cursor_board_seed("WNBA", "underdog") is None


def test_nba_research_seed_is_rejected():
    """NBA seed file is research-warehouse export — must not appear as live pick'em."""
    assert load_cursor_board_seed("NBA", "prizepicks") is None


def test_nhl_research_seed_is_rejected():
    assert load_cursor_board_seed("NHL", "prizepicks") is None


def test_is_live_betting_site_prop_rules():
    assert is_live_betting_site_prop(
        {
            "id": "wnba:pickem:prizepicks:1:points",
            "oddsAreMock": False,
            "oddsRole": "platform-live",
            "platform": "prizepicks",
        }
    )
    assert not is_live_betting_site_prop(
        {
            "id": "nba:prop:1:points:over:20.5",
            "oddsAreMock": True,
            "oddsRole": "comparison-only",
        }
    )
    assert filter_live_betting_site_props(
        [
            {"id": "nba:prop:1:points:over:20.5", "oddsAreMock": True, "oddsRole": "comparison-only"},
            {"id": "mlb:pickem:prizepicks:2:hits", "oddsAreMock": False, "oddsRole": "platform-live"},
        ]
    ) == [{"id": "mlb:pickem:prizepicks:2:hits", "oddsAreMock": False, "oddsRole": "platform-live"}]
