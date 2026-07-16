"""Tests for live pick'em platform board sync (PropLine → model)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.ingestion.pickem_platform_sync import _group_platform_quotes, sync_pickem_platform_board
from app.providers.base import NormalizedOddsQuote


def _q(**kwargs) -> NormalizedOddsQuote:
    base = dict(
        league="NBA",
        player_external_id=None,
        player_name="Jayson Tatum",
        market="Points",
        side="Over",
        line=27.5,
        american_odds=100,
        sportsbook_slug="prizepicks",
        sportsbook_name="PrizePicks",
        game_external_id="evt1",
        captured_at=datetime.now(timezone.utc),
        is_mock=False,
        source_provider="propline",
        quote_external_id="pp-1",
        home_team="Boston Celtics",
        away_team="New York Knicks",
        sport_key="basketball_nba",
    )
    base.update(kwargs)
    return NormalizedOddsQuote(**base)


def test_group_collapses_over_under():
    groups = _group_platform_quotes(
        [
            _q(side="Over", quote_external_id="a"),
            _q(side="Under", quote_external_id="b", american_odds=100),
        ]
    )
    assert len(groups) == 1
    assert groups[0]["over"] is not None
    assert groups[0]["under"] is not None
    assert groups[0]["line"] == 27.5
    assert "a" in groups[0]["projection_ids"]


def test_sync_requires_propline_key():
    db = MagicMock()
    with patch("app.ingestion.pickem_platform_sync.get_settings") as gs:
        gs.return_value = MagicMock(propline_api_key=None, model_disclaimer="d")
        out = sync_pickem_platform_board(db, league="NBA", platform="prizepicks", force=True)
    assert out["requiresApiKey"] is True
    assert out["props"] == []
    assert "PROPLINE_API_KEY" in (out.get("note") or "")


def test_sync_other_unavailable():
    db = MagicMock()
    with patch("app.ingestion.pickem_platform_sync.get_settings") as gs:
        gs.return_value = MagicMock(propline_api_key="k", model_disclaimer="d")
        out = sync_pickem_platform_board(db, league="NBA", platform="other", force=True)
    assert out.get("unavailable") is True
    assert out["props"] == []


def test_sync_builds_board_from_live_quotes_only():
    """Platform feed creates props — sportsbook quotes must not appear."""
    db = MagicMock()
    # Minimal SQLAlchemy-ish stubs for upsert path
    db.get.return_value = None
    db.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))),
        scalar_one_or_none=MagicMock(return_value=None),
        all=MagicMock(return_value=[]),
    )

    quotes = [
        _q(side="Over", sportsbook_slug="prizepicks"),
        _q(side="Under", sportsbook_slug="prizepicks"),
        # Would be filtered by adapter; if present, grouping is still PP-only in this test
    ]

    with (
        patch("app.ingestion.pickem_platform_sync.get_settings") as gs,
        patch("app.ingestion.pickem_platform_sync.PropLineAdapter") as Adapter,
        patch("app.ingestion.pickem_platform_sync.run_provider_job") as job_ctx,
        patch("app.ingestion.pickem_platform_sync._list_cached_platform_board", return_value=None),
        patch("app.ingestion.pickem_platform_sync._ensure_platform_player") as ensure_player,
        patch("app.ingestion.pickem_platform_sync._build_prediction_for_player") as pred,
        patch("app.ingestion.pickem_platform_sync.insert_odds"),
        patch("app.ingestion.pickem_platform_sync._upsert_platform_prop") as upsert_prop,
    ):
        gs.return_value = MagicMock(propline_api_key="test-key", model_disclaimer="d")
        Adapter.return_value.fetch_pickem_prop_odds.return_value = quotes
        Adapter.return_value.league_support.return_value = {"supported": True}
        job_ctx.return_value.__enter__ = MagicMock(return_value=MagicMock(rows_written=0, error=None))
        job_ctx.return_value.__exit__ = MagicMock(return_value=False)

        player = MagicMock(
            id="nba:player:x",
            external_id="x",
            full_name="Jayson Tatum",
            position="F",
            headshot_url=None,
        )
        ensure_player.return_value = player
        pred.return_value = (None, [], [], [], [])  # model pending — still show live line
        prop = MagicMock(id="nba:pickem:prizepicks:x:points")
        upsert_prop.return_value = prop

        # PropAnalytics lookup returns None → create path uses db.add
        analytics_exec = MagicMock()
        analytics_exec.scalar_one_or_none.return_value = None
        # Player find returns empty; game find returns none
        def execute_side_effect(stmt):
            m = MagicMock()
            m.scalars.return_value.all.return_value = []
            m.scalar_one_or_none.return_value = None
            m.all.return_value = []
            return m

        db.execute.side_effect = execute_side_effect

        out = sync_pickem_platform_board(db, league="NBA", platform="prizepicks", force=True)

    assert out["ok"] is True
    assert out["platform"] == "prizepicks"
    assert out["dataSource"] == "pickem:prizepicks"
    assert out["updatedAt"]
    assert len(out["props"]) == 1
    row = out["props"][0]
    assert row["line"] == 27.5
    assert row["platformSlug"] == "prizepicks"
    assert row["oddsAreMock"] is False
    assert row["player"] == "Jayson Tatum"
    assert row["market"] == "Points"
    # Must not invent a projection when model has no logs
    assert row["modelPending"] is True
    Adapter.return_value.fetch_pickem_prop_odds.assert_called()
    call_kwargs = Adapter.return_value.fetch_pickem_prop_odds.call_args
    assert call_kwargs.kwargs.get("platforms") == {"prizepicks"}
