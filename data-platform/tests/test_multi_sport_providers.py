"""Tests for multi-sport provider adapters and generic board helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from app.ingestion.generic_board import market_values_from_logs
from app.providers.mlb.statsapi import MlbStatsApiProvider
from app.providers.nhl.api import NhlApiProvider
from app.providers.registry import get_mlb_providers, get_nhl_providers, provider_status
from app.providers.soccer.football_data import FootballDataOrgProvider
from app.providers.tennis.tennis_abstract import TennisAbstractProvider
from app.providers.the_odds_api.odds import PROP_MARKETS, SPORT_KEYS


def test_mlb_and_nhl_registered_as_live():
    rows = {r["name"]: r for r in provider_status()}
    assert rows["mlb-statsapi"]["configured"] is True
    assert rows["mlb-statsapi"]["requires_api_key"] is False
    assert rows["nhl-api"]["configured"] is True
    assert rows["nhl-api"]["requires_api_key"] is False


def test_soccer_requires_api_key():
    rows = {r["name"]: r for r in provider_status()}
    soccer = rows["football-data-org"]
    assert soccer["requires_api_key"] is True
    assert soccer["envVar"] == "FOOTBALL_DATA_API_KEY"
    provider = FootballDataOrgProvider("")
    assert provider.fetch_schedule("Soccer") == []


def test_tennis_abstract_never_fabricates():
    rows = {r["name"]: r for r in provider_status()}
    tennis = rows["tennis-abstract"]
    assert tennis["configured"] is False
    assert tennis["legitimate"] is False
    provider = TennisAbstractProvider()
    assert provider.fetch_schedule("ATP") == []
    assert provider.fetch_schedule("WTA") == []


def test_mlb_nhl_provider_bundles():
    mlb = get_mlb_providers()
    nhl = get_nhl_providers()
    assert mlb.primary == "mlb-statsapi"
    assert nhl.primary == "nhl-api"
    assert isinstance(mlb.schedule, MlbStatsApiProvider)
    assert isinstance(nhl.schedule, NhlApiProvider)


def test_odds_sport_keys_cover_major_leagues():
    for league in ("NBA", "NFL", "WNBA", "MLB", "NHL", "Soccer"):
        assert league in SPORT_KEYS
        assert league in PROP_MARKETS


def test_market_values_from_raw_logs():
    logs = [
        SimpleNamespace(
            points=2.0,
            assists=None,
            rebounds=None,
            raw={"hits": 3, "homeRuns": 1, "goals": 1, "assists": 2, "shots": 4},
            home=True,
            played_at=datetime.now(timezone.utc),
            minutes=None,
        ),
        SimpleNamespace(
            points=1.0,
            assists=None,
            rebounds=None,
            raw={"hits": 1, "homeRuns": 0, "goals": 0, "assists": 1, "shots": 2},
            home=False,
            played_at=datetime.now(timezone.utc),
            minutes=None,
        ),
    ]
    assert market_values_from_logs(logs, "Hits", raw_stat_key="hits") == [3.0, 1.0]
    assert market_values_from_logs(logs, "Home Runs", raw_stat_key="homeRuns") == [1.0, 0.0]
    assert market_values_from_logs(logs, "Goals", raw_stat_key="goals") == [1.0, 0.0]
    assert market_values_from_logs(logs, "Points", raw_stat_key=None) == [2.0, 1.0]
