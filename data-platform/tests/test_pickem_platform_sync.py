"""Tests for live pick'em platform board sync (multi-API → model)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.ingestion.pickem_platform_sync import _group_platform_quotes, sync_pickem_platform_board
from app.providers.base import NormalizedOddsQuote
from app.providers.line_aggregation.pickem_aggregator import PickemAttempt, PickemFetchResult


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


def test_sync_requires_any_odds_key():
    db = MagicMock()
    with patch("app.ingestion.pickem_platform_sync.get_settings") as gs:
        gs.return_value = MagicMock(
            propline_api_key=None,
            sharpapi_api_key=None,
            odds_api_key=None,
            model_disclaimer="d",
        )
        out = sync_pickem_platform_board(db, league="NBA", platform="prizepicks", force=True)
    assert out["requiresApiKey"] is True
    assert out["props"] == []
    note = out.get("note") or ""
    assert "aren’t available" in note or "aren't available" in note
    assert "PROPLINE_API_KEY" not in note
    assert "ODDS_API_KEY" not in note


def test_sync_other_unavailable():
    db = MagicMock()
    with patch("app.ingestion.pickem_platform_sync.get_settings") as gs:
        gs.return_value = MagicMock(
            propline_api_key="k",
            sharpapi_api_key=None,
            odds_api_key=None,
            model_disclaimer="d",
        )
        out = sync_pickem_platform_board(db, league="NBA", platform="other", force=True)
    assert out.get("unavailable") is True
    assert out["props"] == []


def test_sync_builds_board_from_live_quotes_only():
    """Platform feed creates props — sportsbook quotes must not appear."""
    db = MagicMock()
    db.get.return_value = None
    db.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))),
        scalar_one_or_none=MagicMock(return_value=None),
        all=MagicMock(return_value=[]),
    )

    quotes = [
        _q(side="Over", sportsbook_slug="prizepicks"),
        _q(side="Under", sportsbook_slug="prizepicks"),
    ]
    fetch = PickemFetchResult(
        league="NBA",
        platform="prizepicks",
        quotes=quotes,
        source="propline",
        attempts=[PickemAttempt("propline", "ok", quotes=2)],
    )

    with (
        patch("app.ingestion.pickem_platform_sync.get_settings") as gs,
        patch("app.ingestion.pickem_platform_sync.get_pickem_aggregator") as get_agg,
        patch("app.ingestion.pickem_platform_sync.run_provider_job") as job_ctx,
        patch("app.ingestion.pickem_platform_sync._list_cached_platform_board", return_value=None),
        patch("app.ingestion.pickem_platform_sync._ensure_platform_player") as ensure_player,
        patch("app.ingestion.pickem_platform_sync._build_prediction_for_player") as pred,
        patch("app.ingestion.pickem_platform_sync.insert_odds"),
        patch("app.ingestion.pickem_platform_sync._upsert_platform_prop") as upsert_prop,
    ):
        gs.return_value = MagicMock(
            propline_api_key="test-key",
            sharpapi_api_key=None,
            odds_api_key=None,
            model_disclaimer="d",
        )
        get_agg.return_value.fetch.return_value = fetch
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
        pred.return_value = (None, [], [], [], [], player)
        prop = MagicMock(id="nba:pickem:prizepicks:x:points")
        upsert_prop.return_value = prop

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
    assert out["pickemSource"] == "propline"
    assert out["updatedAt"]
    assert len(out["props"]) == 1
    row = out["props"][0]
    assert row["line"] == 27.5
    assert row["platformSlug"] == "prizepicks"
    assert row["oddsAreMock"] is False
    assert row["player"] == "Jayson Tatum"
    assert row["market"] == "Points"
    assert row["modelPending"] is True
    get_agg.return_value.fetch.assert_called()
    call_kwargs = get_agg.return_value.fetch.call_args
    assert call_kwargs.kwargs.get("platforms") == {"prizepicks"}


def test_sync_accepts_odds_api_key_alone():
    """Boards should work with only ODDS_API_KEY when PropLine is missing."""
    db = MagicMock()
    with (
        patch("app.ingestion.pickem_platform_sync.get_settings") as gs,
        patch("app.ingestion.pickem_platform_sync.get_pickem_aggregator") as get_agg,
        patch("app.ingestion.pickem_platform_sync.run_provider_job") as job_ctx,
        patch("app.ingestion.pickem_platform_sync._list_cached_platform_board", return_value=None),
    ):
        gs.return_value = MagicMock(
            propline_api_key=None,
            sharpapi_api_key=None,
            odds_api_key="odds-key",
            model_disclaimer="d",
        )
        get_agg.return_value.fetch.return_value = PickemFetchResult(
            league="NBA",
            platform="prizepicks",
            quotes=[],
            source=None,
            attempts=[
                PickemAttempt("propline", "skipped", detail="API key not configured"),
                PickemAttempt("sharpapi", "skipped", detail="API key not configured"),
                PickemAttempt("the-odds-api", "empty"),
            ],
        )
        job_ctx.return_value.__enter__ = MagicMock(return_value=MagicMock(rows_written=0, error=None))
        job_ctx.return_value.__exit__ = MagicMock(return_value=False)
        out = sync_pickem_platform_board(db, league="NBA", platform="prizepicks", force=True)
    assert out.get("requiresApiKey") is not True
    assert out.get("pickemAttempts")
