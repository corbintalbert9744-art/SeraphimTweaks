"""Tests for multi-provider line aggregation merge + priority."""

from app.providers.base import NormalizedOddsQuote
from app.providers.line_aggregation.aggregator import MultiProviderAggregator, merge_quotes
from app.providers.base import LeagueSupportStatus, ProviderMeta, ProviderRateLimitError


def _q(**kwargs) -> NormalizedOddsQuote:
    base = dict(
        league="NBA",
        player_external_id=None,
        player_name="Test Player",
        market="Points",
        side="Over",
        line=25.5,
        american_odds=-110,
        sportsbook_slug="draftkings",
        sportsbook_name="DraftKings",
        is_mock=False,
    )
    base.update(kwargs)
    return NormalizedOddsQuote(**base)


def test_merge_prefers_first_provider():
    a = _q(source_provider="propline", line=25.5, american_odds=-105)
    b = _q(source_provider="sharpapi", line=26.5, american_odds=-120)
    merged = merge_quotes([("propline", [a]), ("sharpapi", [b])])
    assert len(merged) == 1
    assert merged[0].source_provider == "propline"
    assert merged[0].line == 25.5


def test_merge_keeps_distinct_books():
    a = _q(sportsbook_slug="draftkings", source_provider="propline")
    b = _q(sportsbook_slug="fanduel", source_provider="sharpapi")
    merged = merge_quotes([("propline", [a]), ("sharpapi", [b])])
    assert len(merged) == 2
    slugs = {q.sportsbook_slug for q in merged}
    assert slugs == {"draftkings", "fanduel"}


class _FakeProvider:
    def __init__(self, sid: str, quotes=None, support=True, rate_limit=False, configured=True):
        self._sid = sid
        self._quotes = quotes or []
        self._support = support
        self._rate_limit = rate_limit
        self._configured = configured
        self.meta = ProviderMeta(name=sid, leagues=["NBA"], capabilities=["odds"])

    @property
    def source_id(self) -> str:
        return self._sid

    def is_configured(self) -> bool:
        return self._configured

    def supports_league(self, league: str) -> LeagueSupportStatus:
        return LeagueSupportStatus(league, self._support, reason=None if self._support else "no")

    def fetch_player_prop_odds(self, league: str, date=None):
        if self._rate_limit:
            raise ProviderRateLimitError(self._sid)
        return list(self._quotes)


def test_aggregator_falls_through_on_rate_limit():
    primary = _FakeProvider("propline", rate_limit=True)
    fallback = _FakeProvider(
        "sharpapi",
        quotes=[_q(source_provider="sharpapi", sportsbook_slug="fanduel")],
    )
    agg = MultiProviderAggregator([primary, fallback])
    result = agg.aggregate("NBA")
    assert len(result.quotes) == 1
    assert result.quotes[0].source_provider == "sharpapi"
    assert result.attempts[0].status == "rate_limited"
    assert result.attempts[1].status == "ok"


def test_aggregator_skips_unconfigured():
    primary = _FakeProvider("propline", configured=False)
    fallback = _FakeProvider("the-odds-api", quotes=[_q(source_provider="the-odds-api")])
    agg = MultiProviderAggregator([primary, fallback])
    result = agg.aggregate("NBA")
    assert result.attempts[0].status == "skipped"
    assert len(result.quotes) == 1
