"""Tests for pick'em short-circuit aggregator (PropLine → SharpAPI → Odds API)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.providers.base import NormalizedOddsQuote, ProviderRateLimitError
from app.providers.line_aggregation.pickem_aggregator import (
    PickemLineAggregator,
    filter_pickem_quotes,
    trip_provider_cooldown,
    _provider_cooldown_until,
)
from app.providers.propline import rate_limit as propline_rate_limit


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
        is_mock=False,
        source_provider="propline",
    )
    base.update(kwargs)
    return NormalizedOddsQuote(**base)


class _FakePickem:
    def __init__(self, sid: str, quotes=None, configured=True, rate_limit=False, error=None):
        self._sid = sid
        self._quotes = quotes or []
        self._configured = configured
        self._rate_limit = rate_limit
        self._error = error
        self.calls = 0

    @property
    def source_id(self) -> str:
        return self._sid

    def is_configured(self) -> bool:
        return self._configured

    def fetch_pickem_prop_odds(self, league, *, platforms, date=None, max_events=None, horizon_hours=48):
        self.calls += 1
        if self._rate_limit:
            raise ProviderRateLimitError(self._sid, "HTTP 429")
        if self._error:
            raise RuntimeError(self._error)
        return list(self._quotes)


def setup_function():
    _provider_cooldown_until.clear()
    propline_rate_limit.clear()


def test_filter_rejects_sportsbook_slugs():
    quotes = [
        _q(sportsbook_slug="prizepicks"),
        _q(sportsbook_slug="draftkings", player_name="Other"),
    ]
    filtered = filter_pickem_quotes(quotes, {"prizepicks"})
    assert len(filtered) == 1
    assert filtered[0].sportsbook_slug == "prizepicks"


def test_short_circuit_stops_after_first_hit():
    primary = _FakePickem("propline", quotes=[_q(source_provider="propline")])
    secondary = _FakePickem(
        "sharpapi", quotes=[_q(source_provider="sharpapi", sportsbook_slug="prizepicks")]
    )
    agg = PickemLineAggregator([primary, secondary])
    result = agg.fetch("NBA", platforms={"prizepicks"})
    assert result.source == "propline"
    assert len(result.quotes) == 1
    assert primary.calls == 1
    assert secondary.calls == 0  # short-circuit — do not burn next quota


def test_falls_through_on_propline_rate_limit():
    primary = _FakePickem("propline", rate_limit=True)
    secondary = _FakePickem(
        "the-odds-api",
        quotes=[_q(source_provider="the-odds-api", sportsbook_slug="prizepicks")],
    )
    agg = PickemLineAggregator([primary, secondary])
    result = agg.fetch("NBA", platforms={"prizepicks"})
    assert result.source == "the-odds-api"
    assert result.attempts[0].status == "rate_limited"
    assert result.attempts[1].status == "ok"


def test_skips_propline_when_circuit_open():
    propline_rate_limit.trip("daily_limit_exceeded")
    primary = _FakePickem("propline", quotes=[_q()])
    secondary = _FakePickem(
        "sharpapi", quotes=[_q(source_provider="sharpapi")]
    )
    agg = PickemLineAggregator([primary, secondary])
    result = agg.fetch("NBA", platforms={"prizepicks"})
    assert primary.calls == 0
    assert result.source == "sharpapi"
    assert result.attempts[0].status == "cooldown"


def test_skips_unconfigured_and_empty():
    primary = _FakePickem("propline", configured=False)
    empty = _FakePickem("sharpapi", quotes=[])
    fallback = _FakePickem(
        "the-odds-api",
        quotes=[_q(source_provider="the-odds-api")],
    )
    agg = PickemLineAggregator([primary, empty, fallback])
    result = agg.fetch("NBA", platforms={"prizepicks"})
    assert result.source == "the-odds-api"
    assert result.attempts[0].status == "skipped"
    assert result.attempts[1].status == "empty"


def test_provider_cooldown_after_429():
    trip_provider_cooldown("sharpapi", minutes=30)
    primary = _FakePickem("propline", quotes=[])
    secondary = _FakePickem("sharpapi", quotes=[_q(source_provider="sharpapi")])
    tertiary = _FakePickem(
        "the-odds-api", quotes=[_q(source_provider="the-odds-api")]
    )
    agg = PickemLineAggregator([primary, secondary, tertiary])
    result = agg.fetch("NBA", platforms={"prizepicks"})
    assert secondary.calls == 0
    assert result.source == "the-odds-api"
    assert result.attempts[1].status == "cooldown"


def test_sportsbook_only_batch_counts_as_empty():
    """Provider returning only DraftKings must not win the pick'em board."""
    primary = _FakePickem(
        "sharpapi",
        quotes=[_q(sportsbook_slug="draftkings", sportsbook_name="DraftKings")],
    )
    secondary = _FakePickem(
        "the-odds-api",
        quotes=[_q(source_provider="the-odds-api", sportsbook_slug="prizepicks")],
    )
    agg = PickemLineAggregator([primary, secondary])
    result = agg.fetch("NBA", platforms={"prizepicks"})
    assert result.source == "the-odds-api"
    assert all(q.sportsbook_slug == "prizepicks" for q in result.quotes)
