"""Provider registry — swap vendors without touching API routes."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import get_settings
from app.providers.base import ProviderMeta
from app.providers.espn.nba import EspnNbaProvider
from app.providers.espn.nfl import EspnNflProvider
from app.providers.mock.odds import MockOddsProvider
from app.providers.the_odds_api.odds import TheOddsApiProvider


@dataclass
class ProviderBundle:
    schedule: object | None = None
    gamelog: object | None = None
    injuries: object | None = None
    odds: object | None = None
    featured: object | None = None


def _odds_provider():
    settings = get_settings()
    if settings.odds_api_key:
        return TheOddsApiProvider(api_key=settings.odds_api_key)
    return MockOddsProvider()


def provider_status() -> list[dict]:
    """Public status for /api/v1/providers — what's live vs needs config."""
    settings = get_settings()
    nba = EspnNbaProvider()
    nfl = EspnNflProvider()
    odds_live = bool(settings.odds_api_key)
    return [
        {
            "name": nba.meta.name,
            "leagues": nba.meta.leagues,
            "capabilities": nba.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "notes": nba.meta.notes,
        },
        {
            "name": nfl.meta.name,
            "leagues": nfl.meta.leagues,
            "capabilities": nfl.meta.capabilities,
            "requires_api_key": False,
            "is_mock": False,
            "configured": True,
            "notes": nfl.meta.notes,
        },
        {
            "name": "the-odds-api",
            "leagues": ["NBA", "NFL", "WNBA", "ATP", "WTA"],
            "capabilities": ["odds", "props"],
            "requires_api_key": True,
            "is_mock": not odds_live,
            "configured": odds_live,
            "notes": (
                "Live sportsbook odds when ODDS_API_KEY is set. "
                "Without a key, MockOddsProvider supplies clearly labeled -110 placeholders."
            ),
        },
        {
            "name": "mock-comparison-lines",
            "leagues": ["NBA", "NFL", "WNBA"],
            "capabilities": ["odds", "props", "pickem"],
            "requires_api_key": False,
            "is_mock": True,
            "configured": True,
            "notes": (
                "MOCK sportsbook + pick'em comparison lines (PrizePicks, Underdog, Sleeper, ParlayPlay). "
                "Swap via ComparisonLinesProvider without UI changes."
            ),
        },
        {
            "name": "espn-wnba",
            "leagues": ["WNBA"],
            "capabilities": ["schedule", "gamelog", "injuries"],
            "requires_api_key": False,
            "is_mock": True,
            "configured": False,
            "notes": "PLANNED — reuse ESPN basketball patterns from NBA adapter.",
        },
        {
            "name": "tennis-provider",
            "leagues": ["ATP", "WTA"],
            "capabilities": ["schedule", "gamelog", "odds"],
            "requires_api_key": True,
            "is_mock": True,
            "configured": False,
            "notes": "REQUIRES PROVIDER SELECTION — ATP/WTA need a licensed tennis + odds source.",
        },
    ]


def get_nba_providers() -> ProviderBundle:
    settings = get_settings()
    espn = EspnNbaProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=_odds_provider(),
        featured=espn,
    )


def get_nfl_providers() -> ProviderBundle:
    settings = get_settings()
    espn = EspnNflProvider(user_agent=settings.espn_user_agent)
    return ProviderBundle(
        schedule=espn,
        gamelog=espn,
        injuries=espn,
        odds=_odds_provider(),
        featured=espn,
    )


def list_metas() -> list[ProviderMeta]:
    return [
        EspnNbaProvider().meta,
        EspnNflProvider().meta,
        MockOddsProvider().meta,
        TheOddsApiProvider(api_key="").meta,
    ]
